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

export default function Register() {
  const { user, registerAccount, completeMfaLogin, acceptSession } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msEmail, setMsEmail] = useState('');
  const [msName, setMsName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [mfaToken, setMfaToken] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [mfaHint, setMfaHint] = useState('123456');
  const [otp, setOtp] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLine, setStatusLine] = useState('');
  const [providers, setProviders] = useState({
    google: false,
    microsoft: false,
    microsoftMode: 'off',
  });

  const nameOk = name.trim().length >= 2;
  const companyOk = company.trim().length >= 2;
  const phoneOk = phone.replace(/\D/g, '').length >= 8;
  const emailOk = EMAIL_RE.test(email.trim());
  const passwordOk = password.length >= 6;
  const formReady = nameOk && companyOk && phoneOk && emailOk && passwordOk;
  const otpOk = /^\d{6}$/.test(otp);

  const liveHint = useMemo(() => {
    if (touched.name && name && !nameOk) return 'Enter your full name';
    if (touched.company && company && !companyOk) return 'Enter company / organization name';
    if (touched.phone && phone && !phoneOk) return 'Enter a valid phone number';
    if (touched.email && email && !emailOk) return 'Enter a valid email address';
    if (touched.password && password && !passwordOk) return 'Password must be at least 6 characters';
    if (formReady && step === 1) return 'All required fields look good — ready to sign up';
    return '';
  }, [touched, name, nameOk, company, companyOk, phone, phoneOk, email, emailOk, password, passwordOk, formReady, step]);

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
      acceptSession(token)
        .then(() => navigate('/dashboard', { replace: true }))
        .catch((e) => setError(e.message || 'Signup failed'));
    }
    if (err || nextStep || token) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markTouched(key) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  async function onMicrosoftLocal(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStatusLine('Creating Microsoft session…');
    try {
      const data = await api.post('/auth/microsoft/local', {
        email: msEmail,
        name: msName || name,
      });
      await acceptSession(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Microsoft login failed');
      setStatusLine('');
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    setTouched({ name: true, company: true, phone: true, email: true, password: true });
    setError('');
    if (!formReady) {
      setError('Fix the highlighted fields to continue');
      return;
    }
    setLoading(true);
    setStatusLine('Creating account…');
    try {
      const data = await registerAccount({
        name: name.trim(),
        email: email.trim(),
        password,
        company: company.trim(),
        phone: `+91${phone.replace(/\D/g, '')}`,
      });
      setMfaToken(data.mfaToken);
      setProfileName(data.name);
      setProfileEmail(data.email);
      if (data.mfaCodeHint) {
        setMfaHint(data.mfaCodeHint);
        setOtp(data.mfaCodeHint);
      }
      setStatusLine('Account created — complete MFA');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Registration failed');
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
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'MFA failed');
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

      <div className="sfw-card auth-panel auth-panel-wide">
        <AuthBrand />
        {step === 1 ? (
          <>
            <h1 className="auth-title">Create Account</h1>
            <p className="sfw-welcome">Join us today!</p>
            <p className="auth-version">{APP_VERSION}</p>

            <form className="auth-form" onSubmit={onRegister} noValidate>
              <label className="sfw-label auth-field-label">
                Full Name <span className="req">*</span>
              </label>
              <input
                className={`sfw-input ${fieldTone(name, touched.name, nameOk)}`}
                value={name}
                placeholder="Enter your Full Name"
                onBlur={() => markTouched('name')}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                required
              />

              <label className="sfw-label auth-field-label">
                Company / Organization Name <span className="req">*</span>
              </label>
              <input
                className={`sfw-input ${fieldTone(company, touched.company, companyOk)}`}
                value={company}
                placeholder="Enter Company / Organization Name"
                onBlur={() => markTouched('company')}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setError('');
                }}
                required
              />

              <label className="sfw-label auth-field-label">
                Phone Number <span className="req">*</span>
              </label>
              <div className="auth-phone-row">
                <div className="auth-country" title="India +91">
                  <span className="auth-flag" aria-hidden="true">
                    🇮🇳
                  </span>
                  <span>+91</span>
                </div>
                <input
                  className={`sfw-input ${fieldTone(phone, touched.phone, phoneOk)}`}
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  placeholder="Phone number"
                  onBlur={() => markTouched('phone')}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/[^\d\s-]/g, ''));
                    setError('');
                  }}
                  required
                />
              </div>

              <label className="sfw-label auth-field-label">
                Email Address <span className="req">*</span>
              </label>
              <input
                className={`sfw-input ${fieldTone(email, touched.email, emailOk)}`}
                type="email"
                value={email}
                placeholder="Enter Email Address"
                onBlur={() => markTouched('email')}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                required
              />

              <label className="sfw-label auth-field-label">
                Password <span className="req">*</span>
              </label>
              <div className="password-wrap auth-password-wrap">
                <input
                  className={`sfw-input ${fieldTone(password, touched.password, passwordOk)}`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="Enter Password"
                  onBlur={() => markTouched('password')}
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

              {liveHint && !error ? (
                <p className={`auth-live-line ${formReady ? 'ok' : ''}`}>{liveHint}</p>
              ) : null}
              {error ? <p className="hive-error">{error}</p> : null}
              {statusLine ? <p className="auth-status">{statusLine}</p> : null}

              <button className="sfw-signin" type="submit" disabled={loading || !formReady}>
                {loading ? 'Creating…' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-divider">Or sign up with</div>
            <SsoButtons
              providers={providers}
              disabled={loading}
              layout="row"
              labels="short"
              onMicrosoftLocal={() => {
                setError('');
                setStep('microsoft');
              }}
            />

            <p className="auth-signup-line" style={{ marginTop: 16 }}>
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </>
        ) : step === 'microsoft' ? (
          <form onSubmit={onMicrosoftLocal} className="auth-form">
            <h1 className="auth-title">Microsoft</h1>
            <p className="sfw-welcome">Enter your Microsoft / Outlook email</p>
            <label className="sfw-label auth-field-label">Display Name</label>
            <input
              className="sfw-input"
              value={msName}
              onChange={(e) => setMsName(e.target.value)}
              placeholder="Your name"
            />
            <label className="sfw-label auth-field-label">
              Microsoft Email <span className="req">*</span>
            </label>
            <input
              className="sfw-input"
              type="email"
              value={msEmail}
              onChange={(e) => setMsEmail(e.target.value)}
              placeholder="name@outlook.com"
              required
              autoFocus
            />
            {error ? <p className="hive-error">{error}</p> : null}
            <button className="sfw-signin" type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Continue →'}
            </button>
            <button type="button" className="hive-back" onClick={() => setStep(1)}>
              ← Back
            </button>
          </form>
        ) : (
          <form onSubmit={onMfa} className="auth-form">
            <h1 className="auth-title">Verify MFA</h1>
            <div className="employee-chip auth-chip">
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
            <label className="sfw-label auth-field-label">
              MFA Code <span className="req">*</span>
            </label>
            <input
              className={`sfw-input ${otp ? (otpOk ? 'is-valid' : 'is-invalid') : ''}`}
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {error ? <p className="hive-error">{error}</p> : null}
            {statusLine ? <p className="auth-status">{statusLine}</p> : null}
            <button className="sfw-signin" type="submit" disabled={loading || !otpOk}>
              {loading ? 'Opening…' : 'Verify & Go to Dashboard →'}
            </button>
          </form>
        )}

        <AuthPoweredBy />
      </div>
    </div>
  );
}
