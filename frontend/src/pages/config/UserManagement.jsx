import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');

  function loadUsers() {
    api
      .get('/users')
      .then((res) => {
        setUsers(res.users || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSaveEdit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.put(`/users/${editingUser.id}`, {
        name: editingUser.name,
        dept: editingUser.dept,
        role_label: editingUser.role_label,
        clearance: editingUser.clearance,
        is_online: editingUser.is_online,
        is_admin: editingUser.is_admin,
      });
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    }
  }

  if (loading) {
    return <div className="muted" style={{ padding: 24 }}>Loading user roster…</div>;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>User Management</h1>
          <p>Configure departments, clearance levels, and admin access</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {users.map((u) => {
          const initials = (u.name || 'U')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join('');

          // Split clearance by comma and trim
          const clearanceTags = (u.clearance || 'SOP, PUBLIC')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

          return (
            <div
              key={u.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                gap: 16,
              }}
            >
              {/* User Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    color: 'var(--teal)',
                    position: 'relative',
                  }}
                >
                  {initials}
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: u.is_online ? '#10b981' : '#6b7280',
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      border: '2px solid var(--card-bg, #12161a)',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{u.name}</div>
                  <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
                    {u.role_label} · {u.dept}
                  </div>
                </div>
              </div>

              {/* Tag badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Department Badge */}
                <span className="badge" style={{ backgroundColor: 'rgba(15,92,76,0.1)', color: '#147a63' }}>
                  {u.dept.toUpperCase()}
                </span>
                
                {/* Clearance Badges */}
                {clearanceTags.map((t) => (
                  <span key={t} className="badge" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    {t.toUpperCase()}
                  </span>
                ))}

                {/* Role Badge */}
                <span className="badge" style={{ backgroundColor: u.is_admin ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)', color: u.is_admin ? '#f59e0b' : 'var(--text2)' }}>
                  {u.is_admin ? 'ADMIN' : 'EMPLOYEE'}
                </span>

                {/* Online Status Badge */}
                <span className="badge" style={{ backgroundColor: u.is_online ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)', color: u.is_online ? '#10b981' : 'var(--text3)' }}>
                  {u.is_online ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </div>

              {/* Actions */}
              <div>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  onClick={() => setEditingUser(u)}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Edit Member Config</h3>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <p style={{ color: 'var(--red)', margin: 0 }}>{error}</p>}
              
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  className="input"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Job Title</label>
                <input
                  type="text"
                  className="input"
                  value={editingUser.role_label || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, role_label: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Department</label>
                <input
                  type="text"
                  className="input"
                  value={editingUser.dept || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, dept: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Clearance (comma-separated)</label>
                <input
                  type="text"
                  className="input"
                  value={editingUser.clearance || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, clearance: e.target.value })}
                  placeholder="e.g. SOP, PUBLIC, ERP"
                />
              </div>

              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingUser.is_admin || false}
                    onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.checked })}
                  />
                  <span>System Admin</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingUser.is_online || false}
                    onChange={(e) => setEditingUser({ ...editingUser, is_online: e.target.checked })}
                  />
                  <span>Online Status</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
