import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import RoleAccessManager from '../../components/RoleAccessManager.jsx';

const FALLBACK_ROLES = [
  { key: 'ADMIN', label: 'Admin', description: 'Full system access.', is_admin: true },
  { key: 'QUALITY_HEAD', label: 'Quality Head', description: 'Approve and close CAPA.', is_admin: false },
  { key: 'QUALITY_MANAGER', label: 'Quality Manager', description: 'Manage complaints and CAPA.', is_admin: false },
  { key: 'QUALITY_EMPLOYEE', label: 'Quality Worker', description: 'Create and update complaints.', is_admin: false },
  { key: 'QUALITY_SUPPORT', label: 'Quality Support', description: 'Support access for quality ops.', is_admin: false },
];

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';
}

function formatLastActive(iso) {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function avatarTone(seed = '') {
  const tones = ['a', 'b', 'c', 'd', 'e'];
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n += seed.charCodeAt(i);
  return tones[n % tones.length];
}

export default function UserManagement() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(FALLBACK_ROLES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    dept: 'Quality',
    role_key: 'QUALITY_EMPLOYEE',
  });
  const [creating, setCreating] = useState(false);

  function flash(msg) {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(''), 3200);
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/users');
      setUsers(data.users || []);
      if (data.roles?.length) setRoles(data.roles);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onRoleChange(userId, roleKey) {
    const prev = users.find((u) => u.id === userId);
    if (!prev || prev.role_key === roleKey) return;

    const role = roles.find((r) => r.key === roleKey);
    setBusyId(userId);
    setError('');
    // Optimistic UI
    setUsers((list) =>
      list.map((u) =>
        u.id === userId
          ? { ...u, role_key: roleKey, role_label: role?.label || roleKey, is_admin: !!role?.is_admin }
          : u
      )
    );

    try {
      const data = await api.put(`/users/${userId}`, { role_key: roleKey });
      setUsers((list) => list.map((u) => (u.id === userId ? { ...u, ...data.user } : u)));
      flash(`Role updated to ${data.user.role_label}`);
    } catch (err) {
      setUsers((list) => list.map((u) => (u.id === userId ? prev : u)));
      setError(err.message || 'Failed to update role');
    } finally {
      setBusyId(null);
    }
  }

  async function onResetPassword(user) {
    if (!window.confirm(`Reset password for ${user.name}?`)) return;
    setBusyId(user.id);
    setError('');
    try {
      const data = await api.post(`/users/${user.id}/reset-password`, {});
      flash(`Temporary password for ${user.email}: ${data.temporaryPassword}`);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(user) {
    if (String(me?.id) === String(user.id)) {
      setError('You cannot delete your own account');
      return;
    }
    if (!window.confirm(`Delete ${user.name} (${user.email})? This cannot be undone.`)) return;
    setBusyId(user.id);
    setError('');
    try {
      await api.del(`/users/${user.id}`);
      setUsers((list) => list.filter((u) => u.id !== user.id));
      flash(`${user.name} deleted`);
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setBusyId(null);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const data = await api.post('/users', createForm);
      setUsers((list) => [...list, data.user].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setShowCreate(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        dept: 'Quality',
        role_key: 'QUALITY_EMPLOYEE',
      });
      flash(`Created ${data.user.name}`);
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="muted">Loading user roster…</div>;
  }

  return (
    <div className="us-panel">
      <div className="us-head">
        <div>
          <h2 className="us-title">User Settings</h2>
          <p className="us-sub">Manage users, roles, and access in real time</p>
        </div>
      </div>

      <div className="us-toolbar">
        <div className="us-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={`us-tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Users
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'roles'}
            className={`us-tab ${tab === 'roles' ? 'active' : ''}`}
            onClick={() => setTab('roles')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Roles
          </button>
        </div>

        {tab === 'users' ? (
          <button type="button" className="btn us-create-btn" onClick={() => setShowCreate(true)}>
            + Create User
          </button>
        ) : null}
      </div>

      {error ? <p className="us-error">{error}</p> : null}
      {toast ? <p className="us-toast">{toast}</p> : null}

      {tab === 'roles' ? (
        <RoleAccessManager onToast={flash} onError={setError} />
      ) : (
        <div className="us-table-wrap">
          <table className="us-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = String(me?.id) === String(u.id);
                const saving = busyId === u.id;
                return (
                  <tr key={u.id} className={saving ? 'is-busy' : ''}>
                    <td>
                      <div className="us-user-cell">
                        <div className={`us-avatar tone-${avatarTone(u.email || u.name)}`}>
                          {initials(u.name)}
                        </div>
                        <div className="us-user-meta">
                          <strong>{u.name}</strong>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="us-role-select"
                        value={u.role_key || ''}
                        disabled={saving}
                        onChange={(e) => onRoleChange(u.id, e.target.value)}
                        aria-label={`Role for ${u.name}`}
                      >
                        {roles.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                        {!roles.some((r) => r.key === u.role_key) && u.role_key ? (
                          <option value={u.role_key}>{u.role_label || u.role_key}</option>
                        ) : null}
                      </select>
                    </td>
                    <td className="us-last-active">{formatLastActive(u.last_login_at)}</td>
                    <td>
                      <div className="us-actions">
                        <button
                          type="button"
                          className="us-action"
                          disabled={saving}
                          onClick={() => onResetPassword(u)}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                          </svg>
                          Reset Password
                        </button>
                        <button
                          type="button"
                          className="us-action danger"
                          disabled={saving || self}
                          title={self ? 'Cannot delete your own account' : 'Delete user'}
                          onClick={() => onDelete(u)}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!users.length ? (
                <tr>
                  <td colSpan={4} className="us-empty">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {showCreate ? (
        <div className="us-modal-backdrop" onClick={() => !creating && setShowCreate(false)}>
          <div
            className="us-modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="us-create-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="us-create-title">Create User</h3>
            <form onSubmit={onCreate} className="us-create-form">
              <label>
                Full name
                <input
                  className="input"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  className="input"
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                />
              </label>
              <label>
                Temporary password
                <input
                  className="input"
                  type="text"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                />
              </label>
              <label>
                Department
                <input
                  className="input"
                  value={createForm.dept}
                  onChange={(e) => setCreateForm((p) => ({ ...p, dept: e.target.value }))}
                />
              </label>
              <label>
                Role
                <select
                  className="input"
                  value={createForm.role_key}
                  onChange={(e) => setCreateForm((p) => ({ ...p, role_key: e.target.value }))}
                >
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="us-modal-actions">
                <button type="button" className="btn secondary" disabled={creating} onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={creating}>
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
