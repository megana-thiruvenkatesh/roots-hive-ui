import React from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function GoogleLogo() {
  return (
    <svg className="sso-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function MicrosoftLogo() {
  return (
    <svg className="sso-logo" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="1.5" width="10" height="10" fill="#F25022" />
      <rect x="12.5" y="1.5" width="10" height="10" fill="#7FBA00" />
      <rect x="1.5" y="12.5" width="10" height="10" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export function EyeIcon({ open = true }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.7a2.8 2.8 0 003.7 3.7M9.4 5.6A9.5 9.5 0 0112 5.5C17.5 5.5 21.5 12 21.5 12a16 16 0 01-3.2 3.9M6.2 6.3A16 16 0 002.5 12S6.5 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AuthBrand({ subtitle }) {
  return (
    <div className="hive-login-brand auth-brand">
      <img src="/logo.png" alt="Hive AI" className="hive-login-logo" />
      <strong className="hive-login-title">Hive AI</strong>
      {subtitle ? <p className="sfw-welcome auth-brand-sub">{subtitle}</p> : null}
    </div>
  );
}

export function AuthCard({ children }) {
  return <div className="sso-login-card">{children}</div>;
}

export function AuthPoweredBy() {
  return (
    <div className="sfw-foot auth-powered">
      <span className="sso-powered-by">Powered by SFW Technologies India Pvt Ltd</span>
    </div>
  );
}

export function SsoButtons({ providers, disabled, onMicrosoftLocal, layout = 'stack', labels = 'full' }) {
  const googleOn = Boolean(providers.google);
  const microsoftOn = Boolean(providers.microsoft);
  const msLocal = providers.microsoftMode === 'local';
  const short = labels === 'short';

  return (
    <div className={layout === 'row' ? 'sso-pair-row' : 'sso-full-stack'}>
      <button
        type="button"
        className={layout === 'row' ? 'sso-pair-btn' : 'sso-full-btn'}
        disabled={disabled || !googleOn}
        onClick={() => {
          window.location.href = `${API_BASE}/auth/google`;
        }}
      >
        <GoogleLogo />
        <span>{short ? 'Google' : 'Login with Google'}</span>
      </button>
      <button
        type="button"
        className={layout === 'row' ? 'sso-pair-btn' : 'sso-full-btn'}
        disabled={disabled || !microsoftOn}
        onClick={() => {
          if (msLocal) {
            onMicrosoftLocal?.();
            return;
          }
          window.location.href = `${API_BASE}/auth/microsoft`;
        }}
      >
        <MicrosoftLogo />
        <span>{short ? 'Microsoft' : 'Login with Microsoft'}</span>
      </button>
    </div>
  );
}
