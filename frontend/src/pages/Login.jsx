import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthBrand, AuthPoweredBy, EyeIcon, SsoButtons } from '../components/AuthShell.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_VERSION = 'v1.0.0';

function fieldTone(value, touched, ok) {
  if (!touched || !value) return '';
  return ok ? 'is-valid' : 'is-invalid';
}

export default function Login() {
  const { user, acceptSession, startPasswordLogin, completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [msEmail, setMsEmail] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [mfaHint, setMfaHint] = useState('123456');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState('');
  const [providers, setProviders] = useState({
    google: false,
    microsoft: false,
    microsoftMode: 'off',
  });

  const emailOk = EMAIL_RE.test(email.trim());
  const passwordOk = password.length >= 6;
  const formReady = emailOk && passwordOk;
  const otpOk = /^\d{6}$/.test(otp);

  const liveHints = useMemo(() => {
    const hints = [];
    if (touched.email && email && !emailOk) hints.push('Enter a valid email address');
    if (touched.password && password && !passwordOk) hints.push('Password must be at least 6 characters');
    if (formReady && step === 1) hints.push('Credentials look good — ready to sign in');
    return hints;
  }, [touched, email, emailOk, password, passwordOk, formReady, step]);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    api
      .get('/auth/providers')
      .then((d) => {
        setProviders(d.providers || {});
        if (d.staticMfaCode) {
          setMfaHint(d.staticMfaCode);
          setOtp(d.staticMfaCode);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const err = params.get('error');
    const nextStep = params.get('step');
    const token = params.get('token');

    if (err) setError(err);
    if (nextStep === 'microsoft') setStep('microsoft');

    if (token) {
      setStatusLine('SSO verified — opening session…');
      acceptSession(token)
        .then(() => navigate('/dashboard', { replace: true }))
        .catch((e) => setError(e.message || 'Login failed'));
    }

    if (err || nextStep || token) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPasswordLogin(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError('');
    if (!formReady) {
      setError('Fix the highlighted fields to continue');
      return;
    }
    setLoading(true);
    setStatusLine('Checking credentials…');
    try {
      const data = await startPasswordLogin(email.trim(), password);
      setMfaToken(data.mfaToken);
      setProfileName(data.name || '');
      setProfileEmail(data.email || email.trim());
      if (data.mfaCodeHint) {
        setMfaHint(data.mfaCodeHint);
        setOtp(data.mfaCodeHint);
      }
      setStatusLine('Credentials accepted — complete MFA');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Login failed');
      setStatusLine('');
    } finally {
      setLoading(false);
    }
  }

  async function onMfa(e) {
    e.preventDefault();
    setError('');
    if (!otpOk) {
      setError('Enter the 6-digit MFA code');
      return;
    }
    setLoading(true);
    setStatusLine('Verifying MFA…');
    try {
      await completeMfaLogin(mfaToken, otp.trim());
      setStatusLine('MFA verified — opening dashboard…');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'MFA failed');
      setStatusLine('');
    } finally {
      setLoading(false);
    }
  }

  async function onMicrosoftLocal(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStatusLine('Signing in with Microsoft email…');
    try {
      const data = await api.post('/auth/microsoft/local', { email: msEmail });
      await acceptSession(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Microsoft login failed');
      setStatusLine('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sfw-login auth-dark">
      <div className="sfw-orb sfw-orb-a" />
      <div className="sfw-orb sfw-orb-b" />
      <div className="sfw-particles" />

      <div className="sfw-card auth-panel">
        <AuthBrand subtitle={step === 1 ? 'Welcome back! Sign in to continue' : null} />
        {step === 1 ? (
          <>
            <p className="auth-version">{APP_VERSION}</p>

            <form className="auth-form" onSubmit={onPasswordLogin} noValidate>
              <label className="sfw-label auth-field-label">
                Email Address <span className="req">*</span>
              </label>
              <input
                className={`sfw-input ${fieldTone(email, touched.email, emailOk)}`}
                type="email"
                value={email}
                autoComplete="email"
                placeholder="Enter Email Address"
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                required
              />
              {touched.email && email && !emailOk ? (
                <p className="auth-field-hint bad">Use a valid email (name@company.com)</p>
              ) : null}

              <label className="sfw-label auth-field-label">
                Password <span className="req">*</span>
              </label>
              <div className="password-wrap auth-password-wrap">
                <input
                  className={`sfw-input ${fieldTone(password, touched.password, passwordOk)}`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  placeholder="Enter Password"
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="show-btn auth-eye-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <EyeIcon open={!showPassword} />
                </button>
              </div>
              {touched.password && password && !passwordOk ? (
                <p className="auth-field-hint bad">At least 6 characters</p>
              ) : null}

              {liveHints.length && !error ? (
                <p className={`auth-live-line ${formReady ? 'ok' : ''}`}>{liveHints[liveHints.length - 1]}</p>
              ) : null}
              {error ? <p className="hive-error">{error}</p> : null}
              {statusLine ? <p className="auth-status">{statusLine}</p> : null}

              <button className="sfw-signin" type="submit" disabled={loading || !formReady}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <div className="auth-divider">Or continue with</div>
            <SsoButtons
              providers={providers}
              disabled={loading}
              layout="row"
              labels="short"
              onMicrosoftLocal={() => {
                setError('');
                setStatusLine('');
                setStep('microsoft');
              }}
            />

            <div className="auth-links">
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => setError('Contact your admin to reset the password for this POC.')}
              >
                Forgot password ?
              </button>
              <p className="auth-signup-line">
                Don&apos;t have an account ? <Link to="/register">Signup</Link>
              </p>
            </div>
          </>
        ) : step === 2 ? (
          <form className="auth-form" onSubmit={onMfa}>
            <h1 className="auth-title">Verify MFA</h1>
            <p className="sfw-welcome">Real-time access check for {profileEmail || 'your account'}</p>
            <div className="employee-chip auth-chip">
              <div className="avatar">
                {(profileName || profileEmail || 'U').slice(0, 2).toUpperCase()}
                <i className="dot" />
              </div>
              <div>
                <div className="chip-title">{profileName || 'User'}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {profileEmail}
                </div>
              </div>
              <span className="scope-pill">MFA</span>
            </div>
            <p className="hive-hint">Static POC MFA code: <strong>{mfaHint}</strong></p>
            <label className="sfw-label auth-field-label">
              MFA Code <span className="req">*</span>
            </label>
            <input
              className={`sfw-input ${otp ? (otpOk ? 'is-valid' : 'is-invalid') : ''}`}
              inputMode="numeric"
              maxLength={6}
              value={otp}
              placeholder="6-digit code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {otp && !otpOk ? <p className="auth-field-hint bad">Enter all 6 digits</p> : null}
            {otpOk ? <p className="auth-live-line ok">Code format OK — ready to verify</p> : null}
            {error ? <p className="hive-error">{error}</p> : null}
            {statusLine ? <p className="auth-status">{statusLine}</p> : null}
            <button className="sfw-signin" type="submit" disabled={loading || !otpOk}>
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>
            <button
              type="button"
              className="hive-back"
              onClick={() => {
                setStep(1);
                setError('');
                setStatusLine('');
              }}
            >
              ← Back to login
            </button>
          </form>
        ) : (
          <form onSubmit={onMicrosoftLocal} className="sso-login-form auth-form">
            <h1 className="auth-title">Microsoft</h1>
            <p className="sfw-welcome" style={{ marginTop: 0 }}>
              Enter your Microsoft email to continue
            </p>
            <label className="sfw-label auth-field-label">
              Microsoft Email <span className="req">*</span>
            </label>
            <input
              className="sfw-input"
              type="email"
              value={msEmail}
              onChange={(e) => setMsEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus
            />
            {error ? <p className="hive-error">{error}</p> : null}
            {statusLine ? <p className="auth-status">{statusLine}</p> : null}
            <button className="sfw-signin" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Continue →'}
            </button>
            <button type="button" className="hive-back" onClick={() => setStep(1)}>
              ← Back
            </button>
          </form>
        )}

        <AuthPoweredBy />
      </div>
    </div>
  );
}
