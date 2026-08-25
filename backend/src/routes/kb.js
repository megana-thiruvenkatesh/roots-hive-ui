const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { ensureKbMediaSchema } = require('../services/kbMedia');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  try {
    await ensureKbMediaSchema();
    const { rows } = await pool.query(
      `SELECT d.id, d.name, d.content, left(d.content, 200) AS preview,
              d.source_type AS "sourceType",
              d.root_cause AS "rootCause", d.solution, d.severity, d.tags,
              d.created_at AS "createdAt",
              d.file_url AS "fileUrl", d.mime_type AS "mimeType", d.file_size AS "fileSize",
              d.original_name AS "originalName", d.record_count AS "recordCount", d.status,
              d.uploaded_by AS "uploadedBy",
              u.name AS "uploadedByName", u.email AS "uploadedByEmail"
       FROM kb_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       ORDER BY d.created_at DESC`
    );
    res.json({
      documents: rows.map((row) => ({ ...row, kind: 'document' })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

/** Combined documents + connectors for Connected Sources / All Uploaded Data */
router.get('/sources', async (_req, res) => {
  try {
    await ensureKbMediaSchema();
    const [docs, connectors] = await Promise.all([
      pool.query(
        `SELECT d.id, d.name, d.created_at AS "createdAt", d.file_url AS "fileUrl",
                d.mime_type AS "mimeType", d.file_size AS "fileSize",
                d.original_name AS "originalName", d.record_count AS "recordCount",
                d.status, d.source_type AS "sourceType",
                d.uploaded_by AS "uploadedBy",
                u.name AS "uploadedByName", u.email AS "uploadedByEmail"
         FROM kb_documents d
         LEFT JOIN users u ON u.id = d.uploaded_by
         ORDER BY d.created_at DESC`
      ),
      pool.query(
        `SELECT c.id, c.name, c.category, c.provider, c.status,
                c.last_sync AS "lastSync", c.record_count AS "recordCount",
                c.created_at AS "createdAt", c.created_by AS "createdBy",
                u.name AS "createdByName", u.email AS "createdByEmail"
         FROM kb_connectors c
         LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.created_at DESC`
      ),
    ]);

    const sources = [
      ...docs.rows.map((row) => ({
        ...row,
        kind: 'document',
        title: row.originalName || row.name,
        uploadedByName: row.uploadedByName,
        uploadedByEmail: row.uploadedByEmail,
        when: row.createdAt,
      })),
      ...connectors.rows.map((row) => ({
        ...row,
        kind: 'connector',
        title: row.name,
        uploadedByName: row.createdByName,
        uploadedByEmail: row.createdByEmail,
        when: row.lastSync || row.createdAt,
      })),
    ].sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));

    res.json({ sources, documents: docs.rows, connectors: connectors.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sources' });
  }
});

/** 4–5 clickable suggested questions derived from KB / data source. */
router.get('/suggestions', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT name, left(content, 500) AS preview
       FROM kb_documents
       ORDER BY created_at DESC
       LIMIT 10`
    );

    const suggestions = [];
    const seen = new Set();

    function push(q) {
      const t = String(q || '').trim().replace(/\s+/g, ' ');
      if (!t || seen.has(t.toLowerCase()) || suggestions.length >= 5) return;
      seen.add(t.toLowerCase());
      suggestions.push(t);
    }

    for (const doc of rows) {
      const name = (doc.name || 'document').replace(/\.[^.]+$/, '');
      const preview = (doc.preview || '').replace(/\s+/g, ' ').trim();
      push(`Summarize the key points in ${name}`);
      push(`What guidance does ${name} provide for quality / CAPA?`);
      const sentence = preview.split(/[.?!]/).map((s) => s.trim()).find((s) => s.length > 24);
      if (sentence) {
        const short = sentence.length > 90 ? `${sentence.slice(0, 87)}…` : sentence;
        push(`Explain: ${short}`);
      }
      if (suggestions.length >= 5) break;
    }

    const fallback = [
      'What are common leakage root causes in manufacturing?',
      'How should we run an 8D for a supplier complaint?',
      'What CAPA steps apply to dimensional deviation?',
      'Show me preventive actions for fitment issues',
      'What does our knowledge base say about containment?',
    ];
    for (const f of fallback) push(f);

    res.json({ suggestions: suggestions.slice(0, 5), fromKb: rows.length > 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

router.post('/search', async (req, res) => {
  const query = (req.body?.query || '').trim();
  if (!query) return res.json({ matches: [] });

  const { rows } = await pool.query(
    `SELECT name AS source, content AS text
     FROM kb_documents
     WHERE content ILIKE $1 OR name ILIKE $1
     LIMIT 8`,
    [`%${query}%`]
  );
  res.json({ matches: rows });
});

router.post('/', async (req, res) => {
  const { name, content, sourceType, rootCause, solution, severity, tags } = req.body || {};
  if (!name || !content) return res.status(400).json({ error: 'name and content required' });
  await ensureKbMediaSchema();
  const { rows } = await pool.query(
    `INSERT INTO kb_documents (name, content, source_type, root_cause, solution, severity, tags, uploaded_by, status, record_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',1)
     RETURNING id, name, source_type AS "sourceType", root_cause AS "rootCause", solution, severity, tags, created_at AS "createdAt"`,
    [name, content, sourceType || 'General', rootCause || '', solution || '', severity || 'Medium', tags || '', req.user.id]
  );
  res.status(201).json({ document: { ...rows[0], kind: 'document' } });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM kb_documents WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
