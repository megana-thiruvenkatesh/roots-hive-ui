const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { callProvider } = require('../services/aiProviders');
const { writeAuditLog } = require('../services/auditLog');

const router = express.Router();
router.use(requireAuth);

async function findKbMatches(query, type) {
  const params = [`%${query}%`];
  let typeClause = '';
  if (type) {
    const t = String(type).toLowerCase().includes('supplier') ? 'Supplier' : 'Internal';
    typeClause = ` AND (source_type = $2 OR source_type = 'General')`;
    params.push(t);
  }

  const { rows } = await pool.query(
    `SELECT name AS source, content AS text, source_type AS "sourceType"
     FROM kb_documents
     WHERE (content ILIKE $1 OR name ILIKE $1)${typeClause}
     LIMIT 5`,
    params
  );

  const capaParams = [`%${query}%`];
  let capaType = '';
  if (type) {
    const t = String(type).toLowerCase().includes('supplier') ? 'Supplier' : 'Internal';
    capaType = ` AND type ILIKE $2`;
    capaParams.push(t);
  }

  const { rows: capaHits } = await pool.query(
    `SELECT id AS source,
            ('Issue: ' || description || E'\nRoot Cause: ' || coalesce(root_cause,'') ||
             E'\nCorrective: ' || coalesce(corrective_action,'')) AS text
     FROM complaints
     WHERE (description ILIKE $1 OR root_cause ILIKE $1 OR corrective_action ILIKE $1)${capaType}
     LIMIT 3`,
    capaParams
  );

  return [...rows, ...capaHits];
}

router.post('/chat', async (req, res) => {
  const { message, kbContext: clientKbContext, systemPrompt, type } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });

  try {
    const { rows: settingsRows } = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'api_settings'"
    );
    const apiSettings = settingsRows[0]?.value || { provider: 'builtin', enabled: false };

    if (apiSettings.provider === 'builtin' || !apiSettings.enabled) {
      return res.json({ handledServerSide: false, reason: 'builtin-or-disabled' });
    }

    const kbMatches = await findKbMatches(message, type);
    const kbContext =
      (kbMatches.length ? kbMatches.map((m) => `[${m.source}]:\n${m.text}`).join('\n---\n') : '') +
      (clientKbContext ? `\n\n${clientKbContext}` : '');

    const sys =
      systemPrompt ||
      `You are HIVE AI, a manufacturing quality & CAPA assistant for ${req.user.dept}. Answer concisely and cite sources when using provided context.`;

    const answer = await callProvider(apiSettings, message, sys, kbContext);
    res.json({
      handledServerSide: true,
      answer,
      sources: kbMatches.map((m) => m.source),
    });
  } catch (e) {
    console.error(e);
    res.status(200).json({ handledServerSide: false, error: e.message });
  }
});

/** Structured RCA / Why-Why / CA suggestion for complaint + AI Engine cards */
router.post('/complaint-assist', async (req, res) => {
  const {
    type,
    description,
    defectCat,
    part,
    partCode,
    message,
    mode = 'rca',
    analysisMethod = 'why-why',
    history = [],
    groundingId,
    grounding,
  } = req.body || {};
  try {
    const { findSimilarHistoric, buildAiSuggestion } = require('../services/typeDataSources');
    const { readCases, hasActiveDataset } = require('../services/historicDataset');

    let matches = await findSimilarHistoric(pool, {
      type,
      description,
      defectCat,
      part,
      partCode,
    });

    // Selected historic case is ground truth — always put it first with seed RCA/Why-Why/CA/PA.
    const preferredId = String(groundingId || grounding?.id || '').trim();
    if (preferredId) {
      const fromDataset = hasActiveDataset()
        ? readCases().find((c) => String(c.id) === preferredId)
        : null;
      const fromMatches = matches.find((m) => String(m.id) === preferredId);
      const grounded = fromDataset || fromMatches || (grounding?.id ? grounding : null);
      if (grounded) {
        const merged = {
          ...(fromMatches || {}),
          ...grounded,
          id: preferredId,
          rootCause: grounded.rootCause || fromMatches?.rootCause || '',
          whyWhy: Array.isArray(grounded.whyWhy) && grounded.whyWhy.length
            ? grounded.whyWhy
            : fromMatches?.whyWhy || [],
          correctiveAction: grounded.correctiveAction || fromMatches?.correctiveAction || '',
          preventiveAction: grounded.preventiveAction || fromMatches?.preventiveAction || '',
          source: 'grounding',
        };
        matches = [merged, ...matches.filter((m) => String(m.id) !== preferredId)];
      }
    }

    const base = buildAiSuggestion({
      type,
      description,
      defectCat,
      matches,
      analysisMethod: mode === 'why-why' || mode === 'analysis' ? analysisMethod : 'why-why',
    });

    function fullRcaAnswer() {
      const whyLines =
        base.whyWhy?.length > 0
          ? base.whyWhy
          : [
              `Problem observed: ${defectCat || 'defect'} — ${String(description || '').slice(0, 120)}`,
              'Immediate process / part condition deviation',
              'Control or detection gap in the current method',
              'Standard / checkpoint not enforced',
            ];
      return [
        'RCA (via Why-Why analysis)',
        '',
        `Root cause: ${base.rootCause}`,
        '',
        'Why-Why analysis:',
        ...whyLines.map((w, i) => `  Why ${i + 1}: ${w}`),
        '',
        `Corrective Action (CA): ${base.correctiveAction}`,
        '',
        `Preventive Action (PA): ${base.preventiveAction}`,
        '',
        base.summary,
      ].join('\n');
    }

    function analysisAnswer() {
      return [
        base.analysisText,
        '',
        `Derived root cause: ${base.rootCause || '—'}`,
        `Corrective Action (CA): ${base.correctiveAction || '—'}`,
        `Preventive Action (PA): ${base.preventiveAction || '—'}`,
      ].join('\n');
    }

    const contextBlock = [
      `Mode: ${mode}`,
      `Analysis method: ${analysisMethod}`,
      `Complaint type: ${type || 'Internal'}`,
      `Defect: ${defectCat || ''}`,
      `Part: ${part || ''}`,
      `Description: ${description || ''}`,
      `Suggested root cause: ${base.rootCause}`,
      `Analysis:\n${base.analysisText}`,
      `Corrective Action: ${base.correctiveAction}`,
      `Preventive Action: ${base.preventiveAction}`,
      `Historic: ${matches.map((m) => m.id).join(', ')}`,
      ...history.slice(-6).map((h) => `${h.role}: ${h.text}`),
    ].join('\n');

    const userMsg =
      message?.trim() ||
      (mode === 'ca'
        ? 'Provide Corrective Action (CA) and Preventive Action (PA) for this complaint.'
        : mode === 'why-why' || mode === 'analysis'
          ? `Provide a ${analysisMethod} analysis from historic data (leave empty if not available), plus root cause, CA and PA.`
          : 'Provide RCA via Why-Why analysis, then Corrective Action (CA) and Preventive Action (PA).');

    const { rows: settingsRows } = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'api_settings'"
    );
    const apiSettings = settingsRows[0]?.value || { provider: 'builtin', enabled: false };

    if (apiSettings.provider !== 'builtin' && apiSettings.enabled) {
      try {
        const answer = await callProvider(
          apiSettings,
          userMsg,
          'You are HIVE AI for CAPA. For Analysis mode, only use the selected method content from historic data. If that method is missing, say it is empty. Always include CA and PA when available. Be concise and structured.',
          contextBlock
        );
        await writeAuditLog({
          user: req.user,
          module: 'New Complaint',
          action: message?.trim() ? 'AI solution chat' : 'AI solution generated',
          detail: message?.trim() ? String(message).slice(0, 200) : `${type || 'Internal'} · ${defectCat || '—'}`,
          meta: { type, defectCat, mode },
        });
        return res.json({
          handledServerSide: true,
          suggestion: base,
          answer,
          matches,
        });
      } catch (e) {
        console.error(e);
      }
    }

    // Builtin / offline response
    let answer;
    if (!message?.trim()) {
      if (mode === 'ca') {
        answer = [
          `Corrective Action (CA): ${base.correctiveAction}`,
          '',
          `Preventive Action (PA): ${base.preventiveAction}`,
          '',
          `Linked root cause: ${base.rootCause}`,
        ].join('\n');
      } else if (mode === 'why-why' || mode === 'analysis') {
        answer = analysisAnswer();
      } else {
        answer = fullRcaAnswer();
      }
    } else {
      const q = message.toLowerCase();
      if (q.includes('prevent')) answer = `Preventive Action (PA): ${base.preventiveAction}`;
      else if (q.includes('correct') || q.includes(' ca') || q.startsWith('ca ') || q.includes('capa'))
        answer = `Corrective Action (CA): ${base.correctiveAction}`;
      else if (q.includes('fishbone') || q.includes('6m') || q.includes('kepner') || q.includes('why'))
        answer = analysisAnswer();
      else if (q.includes('root')) answer = `Root cause: ${base.rootCause}`;
      else if (mode === 'why-why' || mode === 'analysis') answer = analysisAnswer();
      else answer = fullRcaAnswer() + `\n\n(Ask to refine analysis, CA, or PA — ${base.sourceType} data source.)`;
    }

    await writeAuditLog({
      user: req.user,
      module: 'New Complaint',
      action: message?.trim() ? 'AI solution chat' : 'AI solution generated',
      detail: message?.trim() ? String(message).slice(0, 200) : `${type || 'Internal'} · ${defectCat || '—'}`,
      meta: { type, defectCat, mode },
    });

    res.json({
      handledServerSide: true,
      suggestion: base,
      answer,
      matches,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Assist failed' });
  }
});

module.exports = router;
