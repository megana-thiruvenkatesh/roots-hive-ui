const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const {
  frontendUrl,
  googleAuthUrl,
  microsoftAuthUrl,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  createPkce,
} = require('../services/oauth');
const {
  publicUser,
  signAccessToken,
  signMfaToken,
  verifyMfaToken,
  getStaticMfaCode,
  registerLocalUser,
  loginLocalUser,
  upsertSsoUser,
  completeStaticMfa,
} = require('../services/users');
const pool = require('../db/pool');

const router = express.Router();

const pkceByState = new Map();

function microsoftOAuthConfigured() {
  return Boolean(
    String(process.env.MICROSOFT_CLIENT_ID || '').trim() &&
      String(process.env.MICROSOFT_CLIENT_SECRET || '').trim()
  );
}

/** Local Microsoft login when Azure app secret is not available (demo / tenant policy). */
function microsoftLocalEnabled() {
  if (microsoftOAuthConfigured()) return false;
  const flag = String(process.env.MICROSOFT_DEV_LOGIN || 'true').toLowerCase();
  return flag !== 'false' && flag !== '0';
}

function oauthReady() {
  const msOauth = microsoftOAuthConfigured();
  const msLocal = microsoftLocalEnabled();
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: msOauth || msLocal,
    microsoftMode: msOauth ? 'oauth' : msLocal ? 'local' : 'off',
  };
}

function redirectAuthError(res, message, page = 'login') {
  const url = new URL(`/${page}`, frontendUrl());
  url.searchParams.set('error', message);
  return res.redirect(url.toString());
}

function mfaPayload(user) {
  return {
    mfaToken: signMfaToken(user.id),
    email: user.email,
    name: user.name,
    staticMfa: true,
    mfaCodeHint: getStaticMfaCode(),
  };
}

async function finishSsoAndRedirect(res, profile) {
  const user = await upsertSsoUser(profile);
  await pool.query(
    `UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
    [user.id]
  );
  const token = signAccessToken(user);
  const url = new URL('/login', frontendUrl());
  url.searchParams.set('token', token);
  return res.redirect(url.toString());
}

router.get('/providers', (_req, res) => {
  res.json({
    providers: oauthReady(),
    staticMfaCode: getStaticMfaCode(),
    frontendUrl: frontendUrl(),
  });
});

router.post('/register', (_req, res) => {
  res.status(410).json({ error: 'Registration is disabled' });
});

router.post('/login', async (req, res) => {
  try {
    const user = await loginLocalUser(req.body || {});
    res.json({
      message: 'Credentials accepted. Complete MFA to continue.',
      ...mfaPayload(user),
    });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: e.message || 'Login failed' });
  }
});

router.get('/google', (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    return res.redirect(googleAuthUrl(state));
  } catch (e) {
    return redirectAuthError(res, e.message, req.query.from === 'register' ? 'register' : 'login');
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    if (req.query.error) return redirectAuthError(res, String(req.query.error));
    const code = req.query.code;
    if (!code) return redirectAuthError(res, 'Google login cancelled');
    const profile = await exchangeGoogleCode(String(code));
    return finishSsoAndRedirect(res, profile);
  } catch (e) {
    console.error(e);
    return redirectAuthError(res, e.message || 'Google login failed');
  }
});

router.get('/microsoft', (req, res) => {
  const page = req.query.from === 'register' ? 'register' : 'login';
  try {
    if (!microsoftOAuthConfigured()) {
      if (microsoftLocalEnabled()) {
        const url = new URL(`/${page}`, frontendUrl());
        url.searchParams.set('step', 'microsoft');
        return res.redirect(url.toString());
      }
      return redirectAuthError(
        res,
        'Microsoft login is not configured. Add MICROSOFT_CLIENT_ID / SECRET, or set MICROSOFT_DEV_LOGIN=true for demo email login.',
        page
      );
    }
    const state = crypto.randomBytes(16).toString('hex');
    const { verifier, challenge } = createPkce();
    pkceByState.set(state, { verifier, expires: Date.now() + 10 * 60 * 1000 });
    return res.redirect(microsoftAuthUrl(state, challenge));
  } catch (e) {
    return redirectAuthError(res, e.message, page);
  }
});

router.get('/microsoft/callback', async (req, res) => {
  try {
    if (req.query.error) {
      return redirectAuthError(res, String(req.query.error_description || req.query.error));
    }
    const code = req.query.code;
    if (!code) return redirectAuthError(res, 'Microsoft login cancelled');
    const state = String(req.query.state || '');
    const pkce = pkceByState.get(state);
    pkceByState.delete(state);
    if (!pkce || pkce.expires < Date.now()) {
      return redirectAuthError(res, 'Microsoft login expired. Try again.');
    }
    const profile = await exchangeMicrosoftCode(String(code), pkce.verifier);
    return finishSsoAndRedirect(res, profile);
  } catch (e) {
    console.error(e);
    return redirectAuthError(res, e.message || 'Microsoft login failed');
  }
});

/** Local Microsoft: email must already exist in users table. */
router.post('/microsoft/local', async (req, res) => {
  try {
    if (!microsoftLocalEnabled()) {
      return res.status(400).json({
        error: 'Local Microsoft login is disabled. Set MICROSOFT_CLIENT_ID / SECRET for real SSO.',
      });
    }
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const name = String(req.body?.name || '').trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid Microsoft / Outlook email' });
    }
    const user = await upsertSsoUser({
      provider: 'microsoft',
      subject: `local:${email}`,
      email,
      name: name || email.split('@')[0],
      avatarUrl: null,
    });
    await pool.query(
      `UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
      [user.id]
    );
    res.json({
      token: signAccessToken(user),
      user: publicUser(user),
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Microsoft login failed' });
  }
});

router.post('/mfa/verify', async (req, res) => {
  const { mfaToken, code } = req.body || {};
  if (!mfaToken || !code) return res.status(400).json({ error: 'mfaToken and code are required' });

  try {
    const payload = verifyMfaToken(mfaToken);
    const user = await completeStaticMfa(payload.uid, code);
    const token = signAccessToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: e.message || 'MFA verification failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, dept, role_key, role_label, is_admin, auth_provider, avatar_url,
            employee_id AS "employeeId", bio, contact, preferred_shift AS "preferredShift", clearance
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  
  const userObj = {
    ...publicUser(rows[0]),
    employeeId: rows[0].employeeId,
    bio: rows[0].bio,
    contact: rows[0].contact,
    preferredShift: rows[0].preferredShift,
    clearance: rows[0].clearance,
  };
  res.json({ user: userObj });
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, bio, contact, preferredShift } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           bio = COALESCE($2, bio),
           contact = COALESCE($3, contact),
           preferred_shift = COALESCE($4, preferred_shift),
           updated_at = now()
       WHERE id = $5
       RETURNING id, name, email, dept, role_key, role_label, is_admin,
                 employee_id AS "employeeId", bio, contact, preferred_shift AS "preferredShift", clearance`,
      [name, bio, contact, preferredShift, req.user.id]
    );

    const userObj = {
      ...publicUser(rows[0]),
      employeeId: rows[0].employeeId,
      bio: rows[0].bio,
      contact: rows[0].contact,
      preferredShift: rows[0].preferredShift,
      clearance: rows[0].clearance,
    };
    res.json({ user: userObj });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
