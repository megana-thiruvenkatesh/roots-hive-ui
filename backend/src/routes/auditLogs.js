const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { writeAuditLog, ensureAuditTable } = require('../services/auditLog');

const router = express.Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { module, action, status, detail, meta } = req.body || {};
  if (!module || !action) {
    return res.status(400).json({ error: 'module and action are required' });
  }
  await writeAuditLog({
    user: req.user,
    module,
    action,
    status: status || 'ALLOWED',
    detail: detail || '',
    meta: meta || {},
  });
  res.status(201).json({ ok: true });
});

router.get('/', requireRoles('ADMIN', 'QUALITY_HEAD'), async (req, res) => {
  try {
    await ensureAuditTable();
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const moduleFilter = (req.query.module || '').trim();
    const q = (req.query.q || '').trim();

    const clauses = [];
    const params = [];
    let i = 1;

    if (moduleFilter) {
      clauses.push(`module = $${i}`);
      params.push(moduleFilter);
      i++;
    }
    if (q) {
      clauses.push(`(
        coalesce(user_name,'') || ' ' || coalesce(user_email,'') || ' ' ||
        coalesce(dept,'') || ' ' || coalesce(module,'') || ' ' ||
        coalesce(action,'') || ' ' || coalesce(detail,'') || ' ' ||
        coalesce(status,'')
      ) ILIKE $${i}`);
      params.push(`%${q}%`);
      i++;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT id, user_id, user_name, user_email, dept, module, action, status, detail, meta, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${i}`,
      params
    );

    res.json({ logs: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

module.exports = router;
