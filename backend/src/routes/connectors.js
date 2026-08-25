const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { ensureKbMediaSchema } = require('../services/kbMedia');
const { testConnector } = require('../services/connectorTest');
const { writeAuditLog } = require('../services/auditLog');

const router = express.Router();
router.use(requireAuth);

function maskConfig(config = {}) {
  const next = { ...config };
  ['secretAccessKey', 'clientSecret', 'password', 'apiKey', 'token'].forEach((key) => {
    if (next[key]) next[key] = '••••••••';
  });
  return next;
}

function mapConnector(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider,
    config: maskConfig(row.config || {}),
    status: row.status,
    lastSync: row.last_sync,
    lastError: row.last_error,
    recordCount: row.record_count || 0,
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
    createdByEmail: row.created_by_email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kind: 'connector',
  };
}

router.get('/', async (_req, res) => {
  try {
    await ensureKbMediaSchema();
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS created_by_name, u.email AS created_by_email
       FROM kb_connectors c
       LEFT JOIN users u ON u.id = c.created_by
       ORDER BY c.created_at DESC`
    );
    res.json({ connectors: rows.map(mapConnector) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load connectors' });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureKbMediaSchema();
    const { name, category, provider, config, test = true } = req.body || {};
    if (!provider) return res.status(400).json({ error: 'provider is required' });
    const cat = String(category || 'storage').toLowerCase();
    const displayName = name || `${provider} connector`;

    let status = 'CONFIGURED';
    let lastError = null;
    let recordCount = 0;
    let lastSync = null;
    let testMessage = 'Saved without live test.';

    if (test) {
      try {
        const result = await testConnector({ category: cat, provider, config: config || {} });
        status = result.status;
        recordCount = result.recordCount || 0;
        testMessage = result.message;
        lastSync = new Date();
      } catch (err) {
        status = 'ERROR';
        lastError = err.message || 'Connection test failed';
        testMessage = lastError;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO kb_connectors
         (name, category, provider, config, status, last_sync, last_error, record_count, created_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        displayName,
        cat,
        provider,
        JSON.stringify(config || {}),
        status,
        lastSync,
        lastError,
        recordCount,
        req.user.id,
      ]
    );

    const { rows: named } = await pool.query(
      `SELECT c.*, u.name AS created_by_name, u.email AS created_by_email
       FROM kb_connectors c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = $1`,
      [rows[0].id]
    );

    await writeAuditLog({
      user: req.user,
      module: 'Knowledge Base',
      action: 'Connect API',
      status: status === 'ERROR' ? 'BLOCKED' : 'ALLOWED',
      detail: `${provider}: ${testMessage}`,
      meta: { connectorId: rows[0].id, category: cat },
    });

    res.status(201).json({ connector: mapConnector(named[0]), message: testMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to save connector' });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    await ensureKbMediaSchema();
    const { rows } = await pool.query('SELECT * FROM kb_connectors WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Connector not found' });
    const row = rows[0];
    try {
      const result = await testConnector({
        category: row.category,
        provider: row.provider,
        config: row.config || {},
      });
      const { rows: updated } = await pool.query(
        `UPDATE kb_connectors
         SET status = $1, last_sync = now(), last_error = NULL, record_count = $2, updated_at = now()
         WHERE id = $3
         RETURNING *`,
        [result.status, result.recordCount || 0, row.id]
      );
      res.json({ connector: mapConnector(updated[0]), message: result.message });
    } catch (err) {
      const { rows: updated } = await pool.query(
        `UPDATE kb_connectors
         SET status = 'ERROR', last_error = $1, updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [err.message || 'Test failed', row.id]
      );
      res.status(400).json({ connector: mapConnector(updated[0]), error: err.message || 'Test failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to test connector' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await ensureKbMediaSchema();
    await pool.query('DELETE FROM kb_connectors WHERE id = $1', [req.params.id]);
    await writeAuditLog({
      user: req.user,
      module: 'Knowledge Base',
      action: 'Delete Connector',
      detail: `Connector ${req.params.id}`,
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete connector' });
  }
});

module.exports = router;
