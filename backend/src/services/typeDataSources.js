const fs = require('fs');
const path = require('path');
const { readCases, hasActiveDataset } = require('./historicDataset');

const DATA_ROOT = path.join(__dirname, '../../data');

function normalizeType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('supplier')) return 'supplier';
  return 'internal';
}

function folderForType(type) {
  return path.join(DATA_ROOT, normalizeType(type));
}

function scoreText(haystack, needles) {
  const h = String(haystack || '').toLowerCase();
  if (!h) return 0;
  let score = 0;
  for (const n of needles) {
    if (!n || n.length < 2) continue;
    if (h.includes(n)) score += n.length > 5 ? 3 : 1;
  }
  return score;
}

function tokenize(...parts) {
  const raw = parts.filter(Boolean).join(' ').toLowerCase();
  return [
    ...new Set(
      raw
        .split(/[^a-z0-9]+/i)
        .map((w) => w.trim())
        .filter((w) => w.length > 2)
    ),
  ].slice(0, 40);
}

function loadJsonCases(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadCsvCases(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line, idx) => {
      const cols = line.split(',').map((c) => c.trim());
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] || '';
      });
      return {
        id: row.id || `CSV-${idx + 1}`,
        recordDate: row.recordDate || row.record_date || row.date || '',
        symptom: row.symptom || row.defect || '',
        description: row.description || row.desc || '',
        rootCause: row.rootCause || row.root_cause || '',
        whyWhy: String(row.whyWhy || row.why_why || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean),
        correctiveAction: row.correctiveAction || row.corrective_action || '',
        preventiveAction: row.preventiveAction || row.preventive_action || '',
      };
    });
  } catch {
    return [];
  }
}

function loadTypeFileCases(type) {
  const dir = folderForType(type);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const cases = [];
  for (const file of files) {
    const full = path.join(dir, file);
    if (file.toLowerCase().endsWith('.json')) cases.push(...loadJsonCases(full));
    if (file.toLowerCase().endsWith('.csv')) cases.push(...loadCsvCases(full));
  }
  const currentYear = new Date().getFullYear();
  return cases.map((c, index) => ({
    ...c,
    recordDate:
      c.recordDate ||
      c.chunk?.detail?.IMS_DATEOFISSUE ||
      c.date ||
      `${currentYear - (index % 5)}-${String((index % 12) + 1).padStart(2, '0')}-15`,
    source: 'file',
    sourceType: normalizeType(type) === 'supplier' ? 'Supplier' : 'Internal',
  }));
}

async function loadKbCases(pool, type) {
  const sourceType = normalizeType(type) === 'supplier' ? 'Supplier' : 'Internal';
  const { rows } = await pool.query(
    `SELECT id::text AS id, name AS symptom, content AS description,
            source_type AS "sourceType", created_at AS "recordDate"
     FROM kb_documents
     WHERE source_type = $1 OR source_type = 'General'
     ORDER BY created_at DESC
     LIMIT 40`,
    [sourceType]
  );
  return rows.map((r) => ({
    id: `KB-${r.id.slice(0, 8)}`,
    symptom: r.symptom,
    description: r.description,
    recordDate: r.recordDate,
    rootCause: '',
    whyWhy: [],
    correctiveAction: '',
    preventiveAction: '',
    source: 'kb',
    sourceType: r.sourceType,
  }));
}

async function loadDbComplaintCases(pool, type) {
  const typeLabel = normalizeType(type) === 'supplier' ? 'Supplier' : 'Internal';
  const { rows } = await pool.query(
    `SELECT id, defect_category AS symptom, description,
            root_cause AS "rootCause",
            corrective_action AS "correctiveAction",
            preventive_action AS "preventiveAction",
            why_why AS "whyWhy",
            type AS "sourceType",
            severity, part, customer, stage,
            raised_date AS "recordDate"
     FROM complaints
     WHERE type ILIKE $1
     ORDER BY updated_at DESC
     LIMIT 50`,
    [typeLabel]
  );
  return rows.map((r) => ({
    id: r.id,
    symptom: r.symptom || '',
    description: r.description || '',
    recordDate: r.recordDate,
    rootCause: r.rootCause || '',
    whyWhy: Array.isArray(r.whyWhy)
      ? r.whyWhy.map((w) => (typeof w === 'string' ? w : w?.text || JSON.stringify(w)))
      : [],
    correctiveAction: r.correctiveAction || '',
    preventiveAction: r.preventiveAction || '',
    severity: r.severity,
    part: r.part,
    customer: r.customer,
    stage: r.stage,
    source: 'complaint',
    sourceType: r.sourceType || typeLabel,
  }));
}

async function findSimilarHistoric(pool, { type, description, defectCat, part, partCode }) {
  const tokens = tokenize(description, defectCat, part, partCode);
  const exactNeedles = [defectCat, part, partCode]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter((v) => v.length >= 2);

  // Live uploaded Excel is the only historic source when present.
  // With no dataset, return empty — do not fall back to seed files / KB / old complaints.
  let all = [];
  if (hasActiveDataset()) {
    all = readCases().map((c) => ({ ...c, source: 'dataset' }));
  } else {
    all = [];
  }

  if (!tokens.length && !exactNeedles.length) return [];

  const ranked = all
    .map((item) => {
      const chunkText = item.chunk ? JSON.stringify(item.chunk) : '';
      const itemCode = item.partCode || item.chunk?.detail?.IMS_ITEMCODE || '';
      const itemName = item.part || item.chunk?.detail?.IMS_ITEMNAME || '';
      const category = item.defectCat || item.symptom || item.chunk?.detail?.IMS_DEFECTCATEGORY || '';
      let score =
        scoreText(item.description, tokens) * 3 +
        scoreText(category, tokens) * 4 +
        scoreText(itemCode, tokens) * 5 +
        scoreText(itemName, tokens) * 4 +
        scoreText(item.rootCause, tokens) +
        scoreText((item.whyWhy || []).join(' '), tokens) +
        scoreText(item.correctiveAction, tokens) +
        scoreText(chunkText, tokens);

      // Strong boost for exact field hits (item code / name / defect category)
      for (const needle of exactNeedles) {
        if (String(itemCode).toLowerCase() === needle) score += 20;
        else if (String(itemCode).toLowerCase().includes(needle)) score += 10;
        if (String(itemName).toLowerCase().includes(needle)) score += 8;
        if (String(category).toLowerCase() === needle) score += 16;
        else if (String(category).toLowerCase().includes(needle)) score += 8;
        if (String(item.description || '').toLowerCase().includes(needle)) score += 4;
      }

      const similarityScore = Math.min(
        98,
        Math.max(35, Math.round((score / Math.max(tokens.length * 4, 1)) * 100))
      );
      return { ...item, score, similarityScore };
    })
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return ranked;
}

function hasAnalysisContent(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(String(value).trim());
}

function formatAnalysisBlock(method, payload) {
  const labels = {
    'why-why': 'Why-Why',
    fishbone: 'Fishbone',
    '6m': '6M',
    'kepner-tregoe': 'Kepner-Tregoe',
  };
  const label = labels[method] || 'Analysis';

  if (!hasAnalysisContent(payload)) {
    return `${label} Analysis:\nNo ${label} analysis available for this historic case.`;
  }

  if (method === 'why-why') {
    return [
      'Why-Why Analysis:',
      ...(payload || []).map((w, i) => `  Why ${i + 1}: ${w}`),
    ].join('\n');
  }

  if (method === 'fishbone' || method === '6m') {
    return [
      `${label} Analysis:`,
      ...Object.entries(payload || {}).map(([key, value]) => `  ${key}: ${value || '—'}`),
    ].join('\n');
  }

  if (method === 'kepner-tregoe') {
    const kt = payload || {};
    return [
      'Kepner-Tregoe Analysis:',
      `  Problem: ${kt.problem || '—'}`,
      `  IS: ${kt.is || '—'}`,
      `  IS NOT: ${kt.isNot || '—'}`,
      `  Distinction: ${kt.distinction || '—'}`,
      `  Most Probable: ${kt.mostProbable || '—'}`,
    ].join('\n');
  }

  return `${label} Analysis:\nNo ${label} analysis available for this historic case.`;
}

function pickAnalysisPayload(item, method) {
  if (!item) return null;
  if (method === 'why-why') return item.whyWhy || [];
  if (method === 'fishbone') return item.fishbone || null;
  if (method === '6m') return item.sixM || null;
  if (method === 'kepner-tregoe') return item.kepnerTregoe || null;
  return null;
}

function buildAiSuggestion({ type, description, defectCat, matches, analysisMethod = 'why-why' }) {
  const top = matches[0];
  const method = analysisMethod || 'why-why';
  const whyWhy = top?.whyWhy?.length ? top.whyWhy : [];
  const fishbone = top?.fishbone || null;
  const sixM = top?.sixM || null;
  const kepnerTregoe = top?.kepnerTregoe || null;
  const selectedPayload = pickAnalysisPayload(top, method);
  const analysisText = formatAnalysisBlock(method, selectedPayload);

  return {
    summary: top
      ? `Based on similar ${normalizeType(type)} historic case ${top.id}, a likely path is aligned with past closure actions.`
      : `No close historic match yet in the ${normalizeType(type)} data source. Suggested starter RCA below — refine in chat.`,
    rootCause:
      top?.rootCause ||
      `Probable root cause related to ${defectCat || 'quality'} deviation described in the complaint.`,
    whyWhy,
    fishbone,
    sixM,
    kepnerTregoe,
    analysisMethod: method,
    analysisAvailable: hasAnalysisContent(selectedPayload),
    analysisText,
    correctiveAction:
      top?.correctiveAction ||
      'Contain affected lots, verify process settings, re-inspect, and implement immediate process correction.',
    preventiveAction:
      top?.preventiveAction ||
      'Update control plan / work instruction, add detection checkpoint, and train operators.',
    sources: matches.slice(0, 3).map((m) => m.id),
    sourceType: normalizeType(type) === 'supplier' ? 'Supplier' : 'Internal',
    matchId: top?.id || null,
    matchDate: top?.recordDate || null,
    similarityScore: top?.similarityScore || null,
  };
}

module.exports = {
  normalizeType,
  findSimilarHistoric,
  buildAiSuggestion,
  loadTypeFileCases,
  formatAnalysisBlock,
  pickAnalysisPayload,
  hasAnalysisContent,
};
