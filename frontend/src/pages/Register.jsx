import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthBrand, AuthCard, SsoButtons } from '../components/AuthShell.jsx';

export default function Register() {
  const { user, registerAccount, completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msEmail, setMsEmail] = useState('');
  const [msName, setMsName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [mfaHint, setMfaHint] = useState('123456');
  const [otp, setOtp] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({
    google: false,
    microsoft: false,
    microsoftMode: 'off',
  });

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
    if (err) setError(err);
    if (nextStep === 'microsoft') setStep('microsoft');
    if (err || nextStep) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onMicrosoftLocal(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/microsoft/local', {
        email: msEmail,
        name: msName || name,
      });
      setMfaToken(data.mfaToken);
      setProfileName(data.name);
      setProfileEmail(data.email);
      if (data.mfaCodeHint) {
        setMfaHint(data.mfaCodeHint);
        setOtp(data.mfaCodeHint);
      }
      setStep(2);
    } catch (err) {
      setError(err.message || 'Microsoft login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await registerAccount({ name, email, password });
      setMfaToken(data.mfaToken);
      setProfileName(data.name);
      setProfileEmail(data.email);
      if (data.mfaCodeHint) {
        setMfaHint(data.mfaCodeHint);
        setOtp(data.mfaCodeHint);
      }
      setStep(2);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function onMfa(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await completeMfaLogin(mfaToken, otp.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'MFA failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hive-login">
      <button type="button" className="theme-fab" aria-label="Theme">
        ☾
      </button>
      <AuthBrand />

      <AuthCard
        step={step}
        title={
          step === 2 ? 'MFA CODE' : step === 'microsoft' ? 'MICROSOFT / OUTLOOK' : 'CREATE ACCOUNT'
        }
        footerLink={
          step === 1 || step === 'microsoft'
            ? { to: '/login', label: 'Already registered? Sign in →' }
            : null
        }
      >
        {step === 1 ? (
          <>
            <p className="hive-hint" style={{ marginTop: -4, marginBottom: 14 }}>
              Register with email/password, Google / Gmail, or Microsoft / Outlook
              (SSO accounts are created automatically).
            </p>

            <form onSubmit={onRegister}>
              <label className="hive-label">FULL NAME</label>
              <input
                className="hive-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ marginBottom: 12, paddingRight: 14 }}
              />

              <label className="hive-label">EMAIL</label>
              <input
                className="hive-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginBottom: 12, paddingRight: 14 }}
              />

              <label className="hive-label">PASSWORD</label>
              <div className="password-wrap" style={{ marginBottom: 12 }}>
                <input
                  className="hive-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="show-btn"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              <label className="hive-label">CONFIRM PASSWORD</label>
              <input
                className="hive-input"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
                style={{ paddingRight: 14 }}
              />

              {error && <p className="hive-error">{error}</p>}

              <button className="hive-continue" type="submit" disabled={loading}>
                {loading ? 'Creating…' : 'Create account →'}
              </button>
            </form>

            <div className="auth-divider">or register with</div>
            <SsoButtons
              providers={providers}
              disabled={loading}
              onMicrosoftLocal={() => {
                setError('');
                setStep('microsoft');
              }}
            />
          </>
        ) : step === 'microsoft' ? (
          <form onSubmit={onMicrosoftLocal}>
            <p className="hive-hint" style={{ marginTop: -4, marginBottom: 14 }}>
              Enter your Microsoft / Outlook email. Account is created automatically, then MFA.
            </p>
            <label className="hive-label">DISPLAY NAME (optional)</label>
            <input
              className="hive-input"
              value={msName}
              onChange={(e) => setMsName(e.target.value)}
              placeholder="Your name"
              style={{ marginBottom: 12, paddingRight: 14 }}
            />
            <label className="hive-label">MICROSOFT / OUTLOOK EMAIL</label>
            <input
              className="hive-input"
              type="email"
              value={msEmail}
              onChange={(e) => setMsEmail(e.target.value)}
              placeholder="name@outlook.com"
              required
              autoFocus
              style={{ paddingRight: 14 }}
            />
            {error && <p className="hive-error">{error}</p>}
            <button className="hive-continue" type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Continue →'}
            </button>
            <button type="button" className="hive-back" onClick={() => setStep(1)}>
              ← Back
            </button>
          </form>
        ) : (
          <form onSubmit={onMfa}>
            <div className="employee-chip" style={{ marginBottom: 14 }}>
              <div className="avatar">
                {(profileName || profileEmail || 'U').slice(0, 2).toUpperCase()}
                <i className="dot" />
              </div>
              <div>
                <div className="chip-title">{profileName || 'New user'}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {profileEmail}
                </div>
              </div>
              <span className="scope-pill">NEW</span>
            </div>
            <p className="hive-hint">
              Static POC MFA code: <strong>{mfaHint}</strong>
            </p>
            <input
              className="hive-input"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {error && <p className="hive-error">{error}</p>}
            <button className="hive-continue" type="submit" disabled={loading}>
              {loading ? 'Opening…' : 'Verify & Go to Dashboard →'}
            </button>
          </form>
        )}
      </AuthCard>

      <p className="hive-demo-note">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
