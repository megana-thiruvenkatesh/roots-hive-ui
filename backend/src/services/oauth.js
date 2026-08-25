const crypto = require('crypto');
const fetch = require('node-fetch');

function required(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`${name} is not configured in backend .env`);
  return v;
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function googleConfig() {
  return {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
  };
}

function microsoftConfig() {
  const tenant = (process.env.MICROSOFT_TENANT_ID || 'common').trim();
  const clientSecret = String(process.env.MICROSOFT_CLIENT_SECRET || '').trim();
  return {
    clientId: required('MICROSOFT_CLIENT_ID'),
    clientSecret,
    tenant,
    callbackUrl:
      process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:4000/api/auth/microsoft/callback',
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}

function createPkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function googleAuthUrl(state) {
  const { clientId, callbackUrl } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function microsoftAuthUrl(state, codeChallenge) {
  const { clientId, callbackUrl, authUrl } = microsoftConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    prompt: 'select_account',
    state,
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${authUrl}?${params}`;
}

async function exchangeGoogleCode(code) {
  const { clientId, clientSecret, callbackUrl } = googleConfig();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed');
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();
  if (!profileRes.ok || !profile.email) {
    throw new Error(profile.error_description || 'Failed to load Google profile');
  }

  return {
    provider: 'google',
    subject: profile.sub,
    email: String(profile.email).toLowerCase(),
    name: profile.name || profile.email.split('@')[0],
    avatarUrl: profile.picture || null,
  };
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return {};
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

async function exchangeMicrosoftCode(code, codeVerifier) {
  const { clientId, clientSecret, callbackUrl, tokenUrl } = microsoftConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code',
    scope: 'openid profile email User.Read',
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(tokenData.error_description || tokenData.error || 'Microsoft token exchange failed');
  }

  const idClaims = decodeJwtPayload(tokenData.id_token);
  let profile = {};
  if (tokenData.access_token) {
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    profile = await profileRes.json();
    if (!profileRes.ok) {
      profile = {};
    }
  }

  const email = (
    profile.mail ||
    profile.userPrincipalName ||
    profile.otherMails?.[0] ||
    idClaims.email ||
    idClaims.preferred_username ||
    idClaims.upn ||
    ''
  )
    .toString()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Microsoft account has no email. Ensure the app allows email claim / User.Read.');
  }

  return {
    provider: 'microsoft',
    subject: profile.id || idClaims.oid || idClaims.sub || email,
    email,
    name: profile.displayName || idClaims.name || email.split('@')[0],
    avatarUrl: null,
  };
}

module.exports = {
  frontendUrl,
  googleAuthUrl,
  microsoftAuthUrl,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  createPkce,
};
