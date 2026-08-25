import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';

const COUNTRIES = ['India', 'Singapore', 'United States', 'United Kingdom', 'Germany', 'Japan'];
const STATES_BY_COUNTRY = {
  India: ['Tamil Nadu', 'Karnataka', 'Maharashtra', 'Delhi', 'Gujarat', 'Telangana'],
  Singapore: ['Central', 'East', 'North', 'North-East', 'West'],
  'United States': ['California', 'Texas', 'New York', 'Illinois'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  Germany: ['Bavaria', 'Berlin', 'Hamburg'],
  Japan: ['Tokyo', 'Osaka', 'Kanagawa'],
};
const CITIES_BY_STATE = {
  'Tamil Nadu': ['Coimbatore', 'Chennai', 'Madurai', 'Salem'],
  Karnataka: ['Bengaluru', 'Mysuru'],
  Maharashtra: ['Mumbai', 'Pune'],
  Delhi: ['New Delhi'],
  Gujarat: ['Ahmedabad', 'Surat'],
  Telangana: ['Hyderabad'],
  Central: ['Singapore'],
  East: ['Singapore'],
  North: ['Singapore'],
  'North-East': ['Singapore'],
  West: ['Singapore'],
  California: ['San Francisco', 'Los Angeles'],
  Texas: ['Austin', 'Dallas'],
  'New York': ['New York City'],
  Illinois: ['Chicago'],
  England: ['London', 'Manchester'],
  Scotland: ['Edinburgh'],
  Wales: ['Cardiff'],
  'Northern Ireland': ['Belfast'],
  Bavaria: ['Munich'],
  Berlin: ['Berlin'],
  Hamburg: ['Hamburg'],
  Tokyo: ['Tokyo'],
  Osaka: ['Osaka'],
  Kanagawa: ['Yokohama'],
};
const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Japanese', 'German'];
const TIMEZONES = [
  'Asia/Kolkata (IST)',
  'Asia/Singapore (SGT)',
  'Asia/Tokyo (JST)',
  'Europe/London (GMT)',
  'America/New_York (EST)',
];

const EMPTY = {
  firstName: '',
  lastName: '',
  displayName: '',
  gender: '',
  dateOfBirth: '',
  phone: '',
  street: '',
  country: 'India',
  state: '',
  city: '',
  language: 'English',
  timezone: 'Asia/Kolkata (IST)',
  bio: '',
};

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

function calcCompleteness(form, hasAvatar) {
  const checks = [
    form.firstName,
    form.lastName,
    form.displayName,
    form.gender,
    form.dateOfBirth,
    form.phone,
    form.street,
    form.country,
    form.state,
    form.city,
    form.language,
    form.timezone,
    form.bio,
    hasAvatar,
  ];
  const filled = checks.filter((v) => String(v || '').trim()).length;
  return Math.round((filled / checks.length) * 100);
}

export default function MyProfile() {
  const { user, reloadUser, setUser } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    const p = user.profile || {};
    const split = splitName(user.name);
    setForm({
      firstName: p.firstName || split.firstName,
      lastName: p.lastName || split.lastName,
      displayName: p.displayName || user.name || '',
      gender: p.gender || '',
      dateOfBirth: p.dateOfBirth || '',
      phone: p.phone || user.contact || '',
      street: p.street || '',
      country: p.country || 'India',
      state: p.state || '',
      city: p.city || '',
      language: p.language || 'English',
      timezone: p.timezone || 'Asia/Kolkata (IST)',
      bio: user.bio || '',
    });
    setAvatarUrl(user.avatarUrl || null);
    setDirty(false);
  }, [user]);

  const completeness = useMemo(
    () => calcCompleteness(form, Boolean(avatarUrl)),
    [form, avatarUrl]
  );

  const states = STATES_BY_COUNTRY[form.country] || [];
  const cities = CITIES_BY_STATE[form.state] || [];

  const initials = (form.displayName || form.firstName || user?.name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  function upd(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'country') {
        next.state = '';
        next.city = '';
      }
      if (key === 'state') next.city = '';
      if (key === 'firstName' || key === 'lastName') {
        if (!prev.displayName || prev.displayName === `${prev.firstName} ${prev.lastName}`.trim()) {
          next.displayName = `${key === 'firstName' ? value : prev.firstName} ${key === 'lastName' ? value : prev.lastName}`.trim();
        }
      }
      return next;
    });
    setDirty(true);
    setSuccess('');
  }

  function onAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
      setError('Use JPG, PNG, GIF, or WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar max size is 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result || ''));
      setDirty(true);
      setError('');
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const data = await api.put('/auth/profile', {
        name: form.displayName || `${form.firstName} ${form.lastName}`.trim(),
        bio: form.bio,
        contact: form.phone,
        avatarUrl: avatarUrl || null,
        profile: {
          firstName: form.firstName,
          lastName: form.lastName,
          displayName: form.displayName,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          phone: form.phone,
          street: form.street,
          country: form.country,
          state: form.state,
          city: form.city,
          language: form.language,
          timezone: form.timezone,
        },
      });
      if (data.user && setUser) setUser(data.user);
      else await reloadUser();
      setDirty(false);
      setSuccess('Profile saved. Your updates are live for the team.');
      window.setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <div className="muted">Loading profile…</div>;
  }

  const headerName = form.displayName || `${form.firstName} ${form.lastName}`.trim() || user.name;
  const company = user.dept || 'HIVE Roots';

  return (
    <form className="profile-page" onSubmit={handleSave}>
      <div className="profile-page-head">
        <div>
          <h3>My Profile</h3>
          <p>Keep your details current so CAPA and approval flows show the right owner.</p>
        </div>
        {dirty ? <span className="profile-dirty-pill">Unsaved changes</span> : null}
      </div>

      {success ? <div className="profile-banner ok">✓ {success}</div> : null}
      {error ? <div className="profile-banner err">⚠ {error}</div> : null}

      <section className="profile-hero card">
        <div className="profile-hero-banner" />
        <div className="profile-hero-body">
          <div className="profile-avatar-wrap">
            {avatarUrl ? (
              <img className="profile-avatar-img" src={avatarUrl} alt="" />
            ) : (
              <div className="profile-avatar-fallback">{initials}</div>
            )}
          </div>
          <div className="profile-hero-meta">
            <div className="profile-hero-title-row">
              <h2>{headerName}</h2>
              <span className="profile-pill role">{user.roleLabel || 'User'}</span>
              <span className="profile-pill org">{company}</span>
            </div>
            <div className="profile-hero-contact">
              <span>{user.email}</span>
              {form.phone ? <span>· {form.phone}</span> : null}
            </div>
            <div className="profile-completeness">
              <div className="profile-completeness-top">
                <span>Profile completeness</span>
                <strong>{completeness}%</strong>
              </div>
              <div className="profile-completeness-track">
                <span style={{ width: `${completeness}%` }} />
              </div>
              <p>
                {completeness >= 90
                  ? 'Profile looks complete for team workflows.'
                  : 'Complete your profile so teammates know who they are working with.'}
              </p>
            </div>
          </div>
          <div className="profile-avatar-actions">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={onAvatarPick} />
            <button type="button" className="btn secondary profile-avatar-btn" onClick={() => fileRef.current?.click()}>
              Change Avatar
            </button>
            <span className="muted">JPG, GIF or PNG. Max size 2MB.</span>
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-card card">
          <header className="profile-card-head">
            <span className="profile-card-icon personal" aria-hidden="true" />
            <h4>Personal Information</h4>
          </header>
          <div className="profile-fields two">
            <label className="field">
              <span>First Name</span>
              <input className="input" value={form.firstName} onChange={(e) => upd('firstName', e.target.value)} required />
            </label>
            <label className="field">
              <span>Last Name</span>
              <input className="input" value={form.lastName} onChange={(e) => upd('lastName', e.target.value)} />
            </label>
            <label className="field">
              <span>Display Name</span>
              <input className="input" value={form.displayName} onChange={(e) => upd('displayName', e.target.value)} />
            </label>
            <label className="field">
              <span>Role</span>
              <input className="input" value={user.roleLabel || ''} disabled />
            </label>
            <label className="field">
              <span>Gender</span>
              <select className="input" value={form.gender} onChange={(e) => upd('gender', e.target.value)}>
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
            <label className="field">
              <span>Date of Birth</span>
              <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => upd('dateOfBirth', e.target.value)} />
            </label>
          </div>
        </section>

        <section className="profile-card card">
          <header className="profile-card-head">
            <span className="profile-card-icon contact" aria-hidden="true" />
            <h4>Contact</h4>
          </header>
          <div className="profile-fields">
            <label className="field">
              <span>Email</span>
              <input className="input" value={user.email || ''} disabled />
              <em className="field-help">Your login email cannot be changed here.</em>
            </label>
            <label className="field">
              <span>Phone</span>
              <input className="input" value={form.phone} onChange={(e) => upd('phone', e.target.value)} placeholder="e.g. 9807567371" />
            </label>
          </div>
        </section>

        <section className="profile-card card">
          <header className="profile-card-head">
            <span className="profile-card-icon location" aria-hidden="true" />
            <h4>Location</h4>
          </header>
          <div className="profile-fields">
            <label className="field">
              <span>Street Address</span>
              <input className="input" value={form.street} onChange={(e) => upd('street', e.target.value)} placeholder="Street, area" />
            </label>
            <div className="profile-fields three">
              <label className="field">
                <span>Country</span>
                <select className="input" value={form.country} onChange={(e) => upd('country', e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>State</span>
                <select className="input" value={form.state} onChange={(e) => upd('state', e.target.value)}>
                  <option value="">Select</option>
                  {states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>City</span>
                <select className="input" value={form.city} onChange={(e) => upd('city', e.target.value)}>
                  <option value="">Select</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="profile-card card">
          <header className="profile-card-head">
            <span className="profile-card-icon prefs" aria-hidden="true" />
            <h4>Preferences</h4>
          </header>
          <div className="profile-fields two">
            <label className="field">
              <span>Language</span>
              <select className="input" value={form.language} onChange={(e) => upd('language', e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Timezone</span>
              <select className="input" value={form.timezone} onChange={(e) => upd('timezone', e.target.value)}>
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="profile-bio-block">
            <header className="profile-card-head compact">
              <span className="profile-card-icon bio" aria-hidden="true" />
              <h4>Bio</h4>
            </header>
            <label className="field">
              <textarea
                className="input"
                rows={4}
                maxLength={500}
                placeholder="Write a short bio..."
                value={form.bio}
                onChange={(e) => upd('bio', e.target.value)}
              />
              <em className="field-help right">{form.bio.length}/500</em>
            </label>
          </div>
        </section>
      </div>

      <div className="profile-actions">
        <button type="submit" className="btn" disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
