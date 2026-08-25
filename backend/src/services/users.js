const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const STATIC_MFA_CODE = process.env.STATIC_MFA_CODE || '123456';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    dept: user.dept,
    roleKey: user.role_key,
    roleLabel: user.role_label,
    isAdmin: user.is_admin,
    authProvider: user.auth_provider,
    avatarUrl: user.avatar_url || null,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      dept: user.dept,
      roleKey: user.role_key,
      roleLabel: user.role_label,
      isAdmin: user.is_admin,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function signMfaToken(userId) {
  return jwt.sign({ typ: 'mfa', uid: userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function verifyMfaToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.typ !== 'mfa' || !payload.uid) throw new Error('Invalid MFA token');
  return payload;
}

function getStaticMfaCode() {
  return STATIC_MFA_CODE;
}

async function registerLocalUser() {
  throw new Error('Registration is disabled. Ask Admin to create an account.');
}

async function loginLocalUser({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !password) throw new Error('Email and password are required');

  const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [cleanEmail]);
  const user = rows[0];
  if (!user || !user.password_hash) {
    throw new Error('Invalid email or password. If you use Google/Microsoft, sign in with SSO.');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('Invalid email or password');
  return user;
}

async function upsertSsoUser({ provider, subject, email, name, avatarUrl }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('The identity provider did not return a valid email address.');
  }

  const { rows: byProvider } = await pool.query(
    `SELECT * FROM users WHERE auth_provider = $1 AND provider_subject = $2 LIMIT 1`,
    [provider, subject]
  );
  if (byProvider[0]) {
    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           avatar_url = COALESCE($2, avatar_url),
           last_login_at = now(),
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [name, avatarUrl, byProvider[0].id]
    );
    return rows[0];
  }

  const { rows: byEmail } = await pool.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [
    cleanEmail,
  ]);
  if (byEmail[0]) {
    const { rows } = await pool.query(
      `UPDATE users
       SET auth_provider = $1,
           provider_subject = $2,
           name = COALESCE($3, name),
           avatar_url = COALESCE($4, avatar_url),
           last_login_at = now(),
           updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [provider, subject, name, avatarUrl, byEmail[0].id]
    );
    return rows[0];
  }

  throw new Error('This account is not provisioned. Ask Admin to add the user first.');
}

async function completeStaticMfa(userId, code) {
  if (String(code || '').trim() !== STATIC_MFA_CODE) {
    throw new Error(`Invalid MFA code. Use ${STATIC_MFA_CODE}`);
  }
  const { rows } = await pool.query(
    `UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
    [userId]
  );
  if (!rows[0]) throw new Error('User not found');
  return rows[0];
}

module.exports = {
  publicUser,
  signAccessToken,
  signMfaToken,
  verifyMfaToken,
  getStaticMfaCode,
  registerLocalUser,
  loginLocalUser,
  upsertSsoUser,
  completeStaticMfa,
};
