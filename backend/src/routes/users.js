const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { writeAuditLog } = require('../services/auditLog');
const {
  ACTION_LABELS,
  PERMISSION_CATALOG,
  loadStore,
  saveStore,
  countStats,
  flattenGranted,
  defaultPermissionsForRole,
  slugRoleKey,
} = require('../services/roleAccess');

const router = express.Router();
router.use(requireAuth);
router.use(requireRoles('ADMIN'));

async function roleMeta(roleKey) {
  const store = await loadStore();
  return store.roles.find((r) => r.key === roleKey) || null;
}

function publicUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    dept: row.dept,
    role_key: row.role_key,
    role_label: row.role_label,
    is_admin: row.is_admin,
    clearance: row.clearance,
    is_online: row.is_online,
    avatar_url: row.avatar_url,
    last_login_at: row.last_login_at,
  };
}

async function safeAudit(req, action, status, detail, meta = {}) {
  try {
    await writeAuditLog({
      user: req.user,
      module: 'User Settings',
      action,
      status,
      detail,
      meta,
    });
  } catch (err) {
    console.warn('audit log skipped', err.message);
  }
}

function enrichRoles(store, userCounts = {}) {
  return store.roles.map((role) => {
    const perms = store.permissions[role.key] || defaultPermissionsForRole(role.key);
    const stats = countStats(perms);
    const granted = flattenGranted(perms);
    return {
      ...role,
      user_count: userCounts[role.key] || 0,
      stats,
      preview: role.locked
        ? ['Full System & Module Access']
        : granted.slice(0, 4).map((g) => {
            const [mod, act] = g.split('.');
            const modLabel =
              PERMISSION_CATALOG.flatMap((c) => c.modules).find((m) => m.id === mod)?.label || mod;
            return `${ACTION_LABELS[act] || act} (${modLabel})`;
          }),
      more_count: Math.max(0, granted.length - 4),
    };
  });
}

// GET /api/users/role-access — catalog + roles + permissions
router.get('/role-access', async (_req, res) => {
  try {
    const store = await loadStore();
    const { rows } = await pool.query(`SELECT role_key, COUNT(*)::int AS c FROM users GROUP BY role_key`);
    const counts = Object.fromEntries(rows.map((r) => [r.role_key, r.c]));
    res.json({
      catalog: PERMISSION_CATALOG,
      actionLabels: ACTION_LABELS,
      roles: enrichRoles(store, counts),
      permissions: store.permissions,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load role access' });
  }
});

// PUT /api/users/role-access/:roleKey — save permissions (+ optional label/description)
router.put('/role-access/:roleKey', async (req, res) => {
  try {
    const { roleKey } = req.params;
    const store = await loadStore();
    const role = store.roles.find((r) => r.key === roleKey);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.locked || roleKey === 'ADMIN') {
      return res.status(400).json({ error: 'Admin permissions are system-managed and locked' });
    }

    const { label, description, permissions } = req.body || {};
    if (label != null) role.label = String(label).trim() || role.label;
    if (description != null) role.description = String(description).trim();
    if (permissions && typeof permissions === 'object') {
      store.permissions[roleKey] = permissions;
    }

    await saveStore(store);
    await safeAudit(req, 'UPDATE_ROLE_ACCESS', 'ALLOWED', `Updated permissions for ${role.label}`, {
      roleKey,
    });

    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE role_key = $1`, [roleKey]);
    const enriched = enrichRoles(store, { [roleKey]: rows[0]?.c || 0 }).find((r) => r.key === roleKey);
    res.json({
      role: enriched,
      permissions: store.permissions[roleKey],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save role access' });
  }
});

// POST /api/users/role-access — create custom role
router.post('/role-access', async (req, res) => {
  try {
    const { label, description, permissions } = req.body || {};
    const cleanLabel = String(label || '').trim();
    if (!cleanLabel) return res.status(400).json({ error: 'Role name is required' });

    const store = await loadStore();
    let key = slugRoleKey(cleanLabel);
    if (store.roles.some((r) => r.key === key)) key = `${key}_${Date.now().toString(36).toUpperCase()}`;

    const role = {
      key,
      label: cleanLabel,
      description: String(description || '').trim() || 'Custom role',
      locked: false,
      is_admin: false,
      system: false,
    };
    store.roles.push(role);
    store.permissions[key] = permissions && typeof permissions === 'object'
      ? permissions
      : defaultPermissionsForRole(key);

    await saveStore(store);
    await safeAudit(req, 'CREATE_ROLE', 'ALLOWED', `Created role ${cleanLabel}`, { roleKey: key });

    const enriched = enrichRoles(store, { [key]: 0 }).find((r) => r.key === key);
    res.status(201).json({ role: enriched, permissions: store.permissions[key] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// DELETE /api/users/role-access/:roleKey
router.delete('/role-access/:roleKey', async (req, res) => {
  try {
    const { roleKey } = req.params;
    const store = await loadStore();
    const role = store.roles.find((r) => r.key === roleKey);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.system || role.locked) {
      return res.status(400).json({ error: 'System roles cannot be deleted' });
    }
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE role_key = $1`, [roleKey]);
    if ((rows[0]?.c || 0) > 0) {
      return res.status(400).json({ error: 'Reassign users before deleting this role' });
    }
    store.roles = store.roles.filter((r) => r.key !== roleKey);
    delete store.permissions[roleKey];
    await saveStore(store);
    await safeAudit(req, 'DELETE_ROLE', 'ALLOWED', `Deleted role ${role.label}`, { roleKey });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// GET /api/users/roles
router.get('/roles', async (_req, res) => {
  try {
    const store = await loadStore();
    res.json({
      roles: store.roles.map((r) => ({
        key: r.key,
        label: r.label,
        description: r.description,
        is_admin: !!r.is_admin,
        locked: !!r.locked,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load roles' });
  }
});

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const store = await loadStore();
    const { rows } = await pool.query(
      `SELECT id, name, email, dept, role_key, role_label, is_admin, clearance, is_online, avatar_url, last_login_at
       FROM users
       ORDER BY name`
    );
    res.json({
      users: rows.map(publicUserRow),
      roles: store.roles.map((r) => ({
        key: r.key,
        label: r.label,
        description: r.description,
        is_admin: !!r.is_admin,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users - Create user
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      dept = 'Quality',
      role_key = 'QUALITY_EMPLOYEE',
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const cleanDept = String(dept || 'Quality').trim() || 'Quality';
    const role = await roleMeta(role_key);

    if (!cleanName) return res.status(400).json({ error: 'Name is required' });
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!role) return res.status(400).json({ error: 'Invalid role' });

    const { rows: existing } = await pool.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [cleanEmail]
    );
    if (existing[0]) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (
         name, email, password_hash, dept, role_key, role_label, is_admin, auth_provider, clearance, is_online
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', 'SOP, PUBLIC', false)
       RETURNING id, name, email, dept, role_key, role_label, is_admin, clearance, is_online, avatar_url, last_login_at`,
      [cleanName, cleanEmail, passwordHash, cleanDept, role.key, role.label, role.is_admin]
    );

    await safeAudit(req, 'CREATE_USER', 'ALLOWED', `Created user ${cleanEmail} as ${role.label}`, {
      userId: rows[0].id,
      role_key: role.key,
    });

    res.status(201).json({ user: publicUserRow(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user (role change is live)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, dept, role_key, role_label, clearance, is_online, is_admin } = req.body || {};

    const { rows: existingRows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });

    let nextRoleKey = existing.role_key;
    let nextRoleLabel = existing.role_label;
    let nextIsAdmin = existing.is_admin;

    if (role_key) {
      const role = await roleMeta(role_key);
      if (!role) return res.status(400).json({ error: 'Invalid role' });
      nextRoleKey = role.key;
      nextRoleLabel = role.label;
      nextIsAdmin = !!role.is_admin;
    } else if (role_label) {
      nextRoleLabel = role_label;
    }

    if (typeof is_admin === 'boolean' && !role_key) {
      nextIsAdmin = is_admin;
      if (is_admin) {
        nextRoleKey = 'ADMIN';
        nextRoleLabel = 'Admin';
      }
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           dept = COALESCE($2, dept),
           role_key = $3,
           role_label = $4,
           clearance = COALESCE($5, clearance),
           is_online = COALESCE($6, is_online),
           is_admin = $7,
           updated_at = now()
       WHERE id = $8
       RETURNING id, name, email, dept, role_key, role_label, is_admin, clearance, is_online, avatar_url, last_login_at`,
      [
        name !== undefined ? String(name).trim() : null,
        dept !== undefined ? String(dept).trim() : null,
        nextRoleKey,
        nextRoleLabel,
        clearance !== undefined ? clearance : null,
        is_online !== undefined ? is_online : null,
        nextIsAdmin,
        id,
      ]
    );

    if (existing.role_key !== nextRoleKey) {
      await safeAudit(
        req,
        'UPDATE_ROLE',
        'ALLOWED',
        `Changed ${existing.email} role from ${existing.role_key} to ${nextRoleKey}`,
        { userId: id, from: existing.role_key, to: nextRoleKey }
      );
    }

    res.json({ user: publicUserRow(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    let { password } = req.body || {};
    const { rows: existingRows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (!existingRows[0]) return res.status(404).json({ error: 'User not found' });

    if (!password || String(password).length < 6) {
      password = `Temp@${Math.random().toString(36).slice(2, 8)}1`;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, auth_provider = 'local', updated_at = now() WHERE id = $2`,
      [passwordHash, id]
    );

    await safeAudit(req, 'RESET_PASSWORD', 'ALLOWED', `Reset password for ${existingRows[0].email}`, {
      userId: id,
    });

    res.json({ ok: true, temporaryPassword: password });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const { rows: existingRows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (!existingRows[0]) return res.status(404).json({ error: 'User not found' });

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await safeAudit(req, 'DELETE_USER', 'ALLOWED', `Deleted user ${existingRows[0].email}`, {
      userId: id,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
