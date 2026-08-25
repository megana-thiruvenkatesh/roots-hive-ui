import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';

export default function MyProfile() {
  const { user, reloadUser } = useAuth();
  
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [contact, setContact] = useState('');
  const [shift, setShift] = useState('Morning (06:00 - 14:00)');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setContact(user.contact || '');
      setShift(user.preferredShift || 'Morning (06:00 - 14:00)');
      setLoading(false);
    }
  }, [user]);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.put('/auth/profile', {
        name,
        bio,
        contact,
        preferredShift: shift,
      });
      await reloadUser();
      setSuccess('Profile updated successfully.');
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    }
  }

  if (loading) {
    return <div className="muted">Loading profile…</div>;
  }

  const initials = (user?.name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: 15 }}>My Profile</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Personal information visible to teammates in Messaging.</p>
      </div>

      {success && <div style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ {success}</div>}
      {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ {error}</div>}

      {/* Avatar Summary card */}
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px 20px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
        <div style={{
          width: 54, height: 54, borderRadius: '50%', backgroundColor: 'var(--amber-soft)',
          border: '2px solid var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--amber)', position: 'relative'
        }}>
          {initials}
          <span style={{
            width: 14, height: 14, borderRadius: '50%', backgroundColor: '#10b981',
            position: 'absolute', bottom: -2, right: -2, border: '2px solid var(--bg-card)'
          }} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{user?.name}</h4>
          <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>{user?.roleLabel} · {user?.dept}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <span className="badge" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{user?.dept?.toUpperCase()}</span>
            <span className="badge" style={{ backgroundColor: 'rgba(244,63,94,0.1)', color: '#fb7185' }}>{user?.isAdmin ? 'ADMIN' : 'EMPLOYEE'}</span>
            <span className="badge minor">ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Profile Fields Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label className="label">DISPLAY NAME</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label">EMPLOYEE ID</label>
            <input
              type="text"
              className="input"
              value={user?.employeeId || 'EMP-ROO001'}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>
        </div>

        <div className="field">
          <label className="label">SHORT BIO / ROLE SUMMARY</label>
          <textarea
            className="input"
            style={{ minHeight: 65 }}
            placeholder="e.g. Senior engineer managing Line 2 & 3, specialising in compressor systems."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label className="label">CONTACT / EXTENSION</label>
            <input
              type="text"
              className="input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">PREFERRED SHIFT</label>
            <select
              className="input"
              style={{ backgroundColor: 'var(--bg-soft)' }}
              value={shift}
              onChange={(e) => setShift(e.target.value)}
            >
              <option value="Morning (06:00 - 14:00)">Morning (06:00 - 14:00)</option>
              <option value="Afternoon (14:00 - 22:00)">Afternoon (14:00 - 22:00)</option>
              <option value="Night (22:00 - 06:00)">Night (22:00 - 06:00)</option>
              <option value="General Shift">General Shift</option>
            </select>
          </div>
        </div>

        <div style={{ alignSelf: 'flex-start' }}>
          <button type="submit" className="btn">
            Save Profile
          </button>
        </div>
      </form>

      {/* Account & Access Panel */}
      <div className="card" style={{ marginTop: 10, padding: 18, border: '1px solid var(--border)' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Account & Access</h4>
        <p className="muted" style={{ margin: '0 0 14px 0', fontSize: '0.8rem' }}>Managed by your IT administrator</p>
        
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '8px 0', color: 'var(--text2)' }}>Department</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>{user?.dept || 'IT Security'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '8px 0', color: 'var(--text2)' }}>Access Level</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>{user?.roleLabel || 'Administrator'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '8px 0', color: 'var(--text2)' }}>Session Policy</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>30 min auto-logout</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '8px 0', color: 'var(--text2)' }}>MFA Status</td>
              <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--teal)', fontWeight: 'bold' }}>✓ Enabled</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: 'var(--text2)' }}>Last Login</td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>Tue, 11 Aug, 2026 04:00 pm</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
