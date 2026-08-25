const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireRoles('ADMIN'));

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, dept, role_key, role_label, is_admin, clearance, is_online, avatar_url, last_login_at
       FROM users
       ORDER BY name`
    );
    res.json({ users: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/users/:id - Update user details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, dept, role_label, clearance, is_online, is_admin } = req.body || {};

    const { rows: existing } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'User not found' });

    // Determine role_key based on admin status or role_label
    let roleKey = existing[0].role_key;
    if (is_admin === true) {
      roleKey = 'MANAGEMENT';
    } else if (is_admin === false && roleKey === 'MANAGEMENT') {
      roleKey = 'USER';
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           dept = COALESCE($2, dept),
           role_label = COALESCE($3, role_label),
           clearance = COALESCE($4, clearance),
           is_online = COALESCE($5, is_online),
           is_admin = COALESCE($6, is_admin),
           role_key = $7,
           updated_at = now()
       WHERE id = $8
       RETURNING id, name, email, dept, role_key, role_label, is_admin, clearance, is_online`,
      [
        name,
        dept,
        role_label,
        clearance,
        is_online !== undefined ? is_online : null,
        is_admin !== undefined ? is_admin : null,
        roleKey,
        id,
      ]
    );

    res.json({ user: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
