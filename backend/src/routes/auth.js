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
  return Boolean(String(process.env.MICROSOFT_CLIENT_ID || '').trim());
}

function microsoftSecretConfigured() {
  return Boolean(String(process.env.MICROSOFT_CLIENT_SECRET || '').trim());
}

/** Manual Microsoft email login when MICROSOFT_DEV_LOGIN=true (skips Azure redirect). */
function microsoftLocalEnabled() {
  const flag = String(process.env.MICROSOFT_DEV_LOGIN || 'false').toLowerCase();
  return flag === 'true' || flag === '1';
}

function oauthReady() {
  const msLocal = microsoftLocalEnabled();
  const msOauth = !msLocal && microsoftOAuthConfigured();
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: msOauth || msLocal,
    microsoftMode: msLocal ? 'local' : msOauth ? 'oauth' : 'off',
    microsoftSecret: microsoftSecretConfigured(),
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

router.post('/register', async (req, res) => {
  try {
    const user = await registerLocalUser(req.body || {});
    res.status(201).json({
      message: 'Account created. Complete MFA to continue.',
      ...mfaPayload(user),
    });
  } catch (e) {
    console.error(e);
    const status = /already exists/i.test(e.message || '') ? 409 : 400;
    res.status(status).json({ error: e.message || 'Registration failed' });
  }
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
    if (microsoftLocalEnabled()) {
      const url = new URL(`/${page}`, frontendUrl());
      url.searchParams.set('step', 'microsoft');
      return res.redirect(url.toString());
    }
    if (!microsoftOAuthConfigured()) {
      return redirectAuthError(
        res,
        'Microsoft login is not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in backend/.env, or set MICROSOFT_DEV_LOGIN=true for manual email login.',
        page
      );
    }
    if (!microsoftSecretConfigured()) {
      return redirectAuthError(
        res,
        'Microsoft Client ID is set, but MICROSOFT_CLIENT_SECRET is missing. In Azure Portal → App registrations → your app → Certificates & secrets → New client secret, paste the Value into backend/.env, then restart the backend.',
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
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_details JSONB NOT NULL DEFAULT '{}'::jsonb`);
  } catch {
    /* ignore */
  }
  const { rows } = await pool.query(
    `SELECT id, name, email, dept, role_key, role_label, is_admin, auth_provider, avatar_url,
            employee_id AS "employeeId", bio, contact, preferred_shift AS "preferredShift", clearance,
            COALESCE(profile_details, '{}'::jsonb) AS "profileDetails",
            last_login_at AS "lastLoginAt"
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });

  const details = rows[0].profileDetails || {};
  let permissions = null;
  let granted = [];
  try {
    const { loadStore, flattenGranted, fullAccessMap } = require('../services/roleAccess');
    const store = await loadStore();
    const roleKey = rows[0].role_key || req.user.roleKey;
    permissions =
      roleKey === 'ADMIN'
        ? fullAccessMap()
        : store.permissions[roleKey] || null;
    granted = flattenGranted(permissions || {});
  } catch (err) {
    console.warn('role access attach failed', err.message);
  }

  const userObj = {
    ...publicUser(rows[0]),
    employeeId: rows[0].employeeId,
    bio: rows[0].bio,
    contact: rows[0].contact,
    preferredShift: rows[0].preferredShift,
    clearance: rows[0].clearance,
    lastLoginAt: rows[0].lastLoginAt,
    profile: details,
    permissions,
    granted,
  };
  res.json({ user: userObj });
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_details JSONB NOT NULL DEFAULT '{}'::jsonb`);

    const body = req.body || {};
    const { name, bio, contact, preferredShift, avatarUrl, profile = {} } = body;

    const profileDetails = {
      firstName: String(profile.firstName || '').trim(),
      lastName: String(profile.lastName || '').trim(),
      displayName: String(profile.displayName || '').trim(),
      gender: String(profile.gender || '').trim(),
      dateOfBirth: String(profile.dateOfBirth || '').trim(),
      phone: String(profile.phone || contact || '').trim(),
      street: String(profile.street || '').trim(),
      country: String(profile.country || '').trim(),
      state: String(profile.state || '').trim(),
      city: String(profile.city || '').trim(),
      language: String(profile.language || 'English').trim(),
      timezone: String(profile.timezone || '').trim(),
    };

    const display =
      profileDetails.displayName ||
      [profileDetails.firstName, profileDetails.lastName].filter(Boolean).join(' ') ||
      name ||
      null;
    const phone = profileDetails.phone || contact || null;

    if (avatarUrl != null && String(avatarUrl).length > 2_800_000) {
      return res.status(400).json({ error: 'Avatar too large. Max size 2MB.' });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           bio = COALESCE($2, bio),
           contact = COALESCE($3, contact),
           preferred_shift = COALESCE($4, preferred_shift),
           avatar_url = COALESCE($5, avatar_url),
           profile_details = $6::jsonb,
           updated_at = now()
       WHERE id = $7
       RETURNING id, name, email, dept, role_key, role_label, is_admin, avatar_url,
                 employee_id AS "employeeId", bio, contact, preferred_shift AS "preferredShift", clearance,
                 COALESCE(profile_details, '{}'::jsonb) AS "profileDetails",
                 last_login_at AS "lastLoginAt"`,
      [
        display,
        bio ?? null,
        phone,
        preferredShift ?? null,
        avatarUrl === undefined ? null : avatarUrl,
        JSON.stringify(profileDetails),
        req.user.id,
      ]
    );

    const details = rows[0].profileDetails || {};
    const userObj = {
      ...publicUser(rows[0]),
      employeeId: rows[0].employeeId,
      bio: rows[0].bio,
      contact: rows[0].contact,
      preferredShift: rows[0].preferredShift,
      clearance: rows[0].clearance,
      lastLoginAt: rows[0].lastLoginAt,
      profile: details,
    };
    res.json({ user: userObj });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to update profile' });
  }
});

module.exports = router;
