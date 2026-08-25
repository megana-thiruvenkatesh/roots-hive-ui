import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { SsoButtons } from '../components/AuthShell.jsx';

export default function Login() {
  const { user, acceptSession } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [msEmail, setMsEmail] = useState('');
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
      .then((d) => setProviders(d.providers || {}))
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
        .catch((e) => setError(e.message || 'Login failed'));
    }

    if (err || nextStep || token) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onMicrosoftLocal(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/microsoft/local', { email: msEmail });
      await acceptSession(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Microsoft login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sfw-login">
      <div className="sfw-orb sfw-orb-a" />
      <div className="sfw-orb sfw-orb-b" />
      <div className="sfw-particles" />

      <div className="sfw-card sso-only-card">
        <div className="hive-login-brand">
          <img src="/logo.png" alt="Hive AI" className="hive-login-logo" />
          <strong className="hive-login-title">Hive AI</strong>
        </div>
        <p className="sfw-welcome">Welcome back! Sign in to continue</p>

        {step === 1 ? (
          <>
            {error ? <p className="hive-error">{error}</p> : null}
            <SsoButtons
              providers={providers}
              disabled={loading}
              onMicrosoftLocal={() => {
                setError('');
                setStep('microsoft');
              }}
            />
          </>
        ) : (
          <form onSubmit={onMicrosoftLocal} className="sso-login-form">
            <p className="sfw-welcome" style={{ marginTop: 0 }}>
              Enter your Microsoft email to continue
            </p>
            <label className="sfw-label">Microsoft Email</label>
            <input
              className="sfw-input"
              type="email"
              value={msEmail}
              onChange={(e) => setMsEmail(e.target.value)}
              placeholder="name@sfwtechnologies.com"
              required
              autoFocus
            />
            {error ? <p className="hive-error">{error}</p> : null}
            <button className="sfw-signin" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Continue →'}
            </button>
            <button type="button" className="hive-back" onClick={() => setStep(1)}>
              ← Back
            </button>
          </form>
        )}

        <div className="sfw-foot">
          <span className="sso-powered-by">powered by SFW Technologies India Pvt Ltd</span>
        </div>
      </div>
    </div>
  );
}
