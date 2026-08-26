import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { actionLabel, clonePermissions, countPermissionStats } from '../lib/roleAccess.js';

function PermChip({ on, label, locked, editing, onToggle }) {
  return (
    <button
      type="button"
      className={`ra-chip ${on ? 'on' : 'off'} ${locked || !editing ? 'locked' : ''}`}
      disabled={locked || !editing}
      onClick={() => editing && !locked && onToggle?.()}
      title={locked ? 'System locked' : editing ? (on ? 'Click to disable' : 'Click to enable') : label}
    >
      <span className="ra-chip-mark">{on ? '✓' : '•'}</span>
      {label}
    </button>
  );
}

function Toggle({ on, disabled, onChange, labelOn = 'ENABLED', labelOff = 'DISABLED' }) {
  return (
    <button
      type="button"
      className={`ra-switch ${on ? 'on' : 'off'}`}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!on)}
      aria-pressed={on}
    >
      <span className={`ra-switch-label ${on ? 'on' : ''}`}>{on ? labelOn : labelOff}</span>
      <span className="ra-switch-track"><span className="ra-switch-knob" /></span>
    </button>
  );
}

export default function RoleAccessManager({ onToast, onError }) {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [actionLabels, setActionLabels] = useState({});
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [viewRole, setViewRole] = useState(null);
  const [editRole, setEditRole] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftMeta, setDraftMeta] = useState({ label: '', description: '' });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ label: '', description: '' });

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/users/role-access');
      setCatalog(data.catalog || []);
      setActionLabels(data.actionLabels || {});
      setRoles(data.roles || []);
      setPermissions(data.permissions || {});
    } catch (err) {
      onError?.(err.message || 'Failed to load role access');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openView(role) {
    setViewRole(role);
    setFilter('all');
    setQuery('');
  }

  function openEdit(role) {
    if (role.locked) return;
    setEditRole(role);
    setDraft(clonePermissions(permissions[role.key]));
    setDraftMeta({ label: role.label, description: role.description || '' });
    setFilter('all');
    setQuery('');
  }

  function closeModals() {
    setViewRole(null);
    setEditRole(null);
    setDraft(null);
    setShowNew(false);
  }

  const activePerms = editRole ? draft : viewRole ? permissions[viewRole.key] : null;
  const activeRole = editRole || viewRole;

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog || [])
      .map((cat) => {
        const modules = (cat.modules || []).filter((mod) => {
          const p = activePerms?.[mod.id];
          const enabled = Boolean(p?.enabled && Object.values(p.actions || {}).some(Boolean));
          if (filter === 'enabled' && !enabled) return false;
          if (filter === 'disabled' && enabled) return false;
          if (!q) return true;
          const hay = `${mod.label} ${mod.actions.join(' ')} ${cat.category}`.toLowerCase();
          return hay.includes(q);
        });
        return { ...cat, modules };
      })
      .filter((cat) => cat.modules.length);
  }, [catalog, activePerms, filter, query]);

  const liveStats = useMemo(
    () => countPermissionStats(catalog, activePerms),
    [catalog, activePerms]
  );

  function setModuleEnabled(moduleId, enabled, actions) {
    setDraft((prev) => {
      const next = clonePermissions(prev);
      if (!next[moduleId]) return prev;
      next[moduleId].enabled = enabled;
      for (const a of actions) {
        next[moduleId].actions[a] = enabled;
      }
      return next;
    });
  }

  function toggleAction(moduleId, action, allActions) {
    setDraft((prev) => {
      const next = clonePermissions(prev);
      if (!next[moduleId]) return prev;
      const now = !next[moduleId].actions[action];
      next[moduleId].actions[action] = now;
      const any = Object.values(next[moduleId].actions).some(Boolean);
      next[moduleId].enabled = any;
      // if turning on an action, ensure module enabled
      if (now) next[moduleId].enabled = true;
      return next;
    });
  }

  async function saveEdit() {
    if (!editRole || !draft) return;
    setSaving(true);
    try {
      const data = await api.put(`/users/role-access/${editRole.key}`, {
        label: draftMeta.label,
        description: draftMeta.description,
        permissions: draft,
      });
      setPermissions((p) => ({ ...p, [editRole.key]: data.permissions }));
      setRoles((list) => list.map((r) => (r.key === editRole.key ? { ...r, ...data.role } : r)));
      onToast?.(`Saved permissions for ${data.role.label}`);
      closeModals();
    } catch (err) {
      onError?.(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }

  async function createRole(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.post('/users/role-access', newForm);
      setRoles((list) => [...list, data.role]);
      setPermissions((p) => ({ ...p, [data.role.key]: data.permissions }));
      onToast?.(`Created role ${data.role.label}`);
      setShowNew(false);
      setNewForm({ label: '', description: '' });
      openEdit(data.role);
    } catch (err) {
      onError?.(err.message || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role) {
    if (role.system || role.locked) return;
    if (!window.confirm(`Delete role "${role.label}"?`)) return;
    try {
      await api.del(`/users/role-access/${role.key}`);
      setRoles((list) => list.filter((r) => r.key !== role.key));
      setPermissions((p) => {
        const next = { ...p };
        delete next[role.key];
        return next;
      });
      onToast?.(`Deleted ${role.label}`);
    } catch (err) {
      onError?.(err.message || 'Failed to delete role');
    }
  }

  if (loading) return <div className="muted">Loading roles…</div>;

  return (
    <div className="ra-root">
      <div className="ra-top-actions">
        <button type="button" className="btn us-create-btn" onClick={() => setShowNew(true)}>
          + New Role
        </button>
      </div>

      <div className="ra-cards">
        {roles.map((role) => {
          const stats = role.stats || countPermissionStats(catalog, permissions[role.key]);
          return (
            <div key={role.key} className="ra-card">
              <div className="ra-card-head">
                <div>
                  <div className="ra-card-title-row">
                    <h3>{role.label}</h3>
                    {role.locked ? (
                      <span className="ra-badge locked">🔒 System Locked</span>
                    ) : (
                      <span className="ra-badge">Role</span>
                    )}
                  </div>
                  <p className="ra-card-desc">{role.description}</p>
                </div>
                {!role.locked ? (
                  <div className="ra-card-tools">
                    <button type="button" className="ra-icon-btn" title="Edit" onClick={() => openEdit(role)}>
                      ✎
                    </button>
                    {!role.system ? (
                      <button type="button" className="ra-icon-btn danger" title="Delete" onClick={() => deleteRole(role)}>
                        🗑
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="ra-card-perms">
                <div className="ra-card-perms-head">
                  <span>MODULE PERMISSIONS</span>
                  <strong>
                    {role.locked
                      ? 'Full Access'
                      : `${stats.permsGranted} active`}
                  </strong>
                </div>
                <div className="ra-preview-chips">
                  {role.locked ? (
                    <span className="ra-preview on">Full System & Module Access</span>
                  ) : (
                    <>
                      {(role.preview || []).map((t) => (
                        <span key={t} className="ra-preview">{t}</span>
                      ))}
                      {role.more_count > 0 ? (
                        <span className="ra-preview more">+{role.more_count} more</span>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div className="ra-card-foot">
                <span>{role.user_count || 0} user{(role.user_count || 0) === 1 ? '' : 's'} assigned</span>
                <button type="button" className="ra-link" onClick={() => openView(role)}>
                  View Permissions →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(viewRole || editRole) && activeRole ? (
        <div className="ra-modal-backdrop" onClick={closeModals}>
          <div
            className={`ra-modal ${editRole ? 'editing' : ''}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ra-modal-head">
              <div>
                <div className="ra-modal-title-row">
                  <span className="ra-shield" aria-hidden="true">🛡</span>
                  {editRole ? (
                    <input
                      className="input ra-name-input"
                      value={draftMeta.label}
                      onChange={(e) => setDraftMeta((p) => ({ ...p, label: e.target.value }))}
                    />
                  ) : (
                    <h2>{activeRole.label}</h2>
                  )}
                  {activeRole.locked ? (
                    <span className="ra-badge locked">🔒 System Locked</span>
                  ) : (
                    <span className="ra-badge custom">{activeRole.system ? 'System Role' : 'Custom Role'}</span>
                  )}
                </div>
                {editRole ? (
                  <textarea
                    className="input ra-desc-input"
                    rows={2}
                    value={draftMeta.description}
                    onChange={(e) => setDraftMeta((p) => ({ ...p, description: e.target.value }))}
                  />
                ) : (
                  <p className="ra-card-desc">{activeRole.description}</p>
                )}
                <div className="ra-stats">
                  <span>
                    <i className="dot" />
                    {liveStats.modulesEnabled} of {liveStats.modulesTotal} Modules Enabled
                  </span>
                  <span>
                    <i className="shield" />
                    {liveStats.permsGranted} of {liveStats.permsTotal} Permissions Granted
                  </span>
                  <span>
                    <i className="users" />
                    {activeRole.user_count || 0} Users Assigned
                  </span>
                </div>
              </div>
              <button type="button" className="ra-close" onClick={closeModals} aria-label="Close">
                ×
              </button>
            </div>

            <div className="ra-toolbar">
              <div className="ra-search">
                <span aria-hidden="true">⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by module or action..."
                />
              </div>
              <div className="ra-filters">
                {[
                  ['all', 'All Modules'],
                  ['enabled', 'Enabled'],
                  ['disabled', 'Disabled'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`ra-filter ${filter === k ? 'active' : ''}`}
                    onClick={() => setFilter(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ra-body">
              {editRole ? (
                filteredCatalog.map((cat) => (
                  <section key={cat.category} className="ra-cat">
                    <div className="ra-cat-head">
                      <h4>{cat.category}</h4>
                      <span>{cat.modules.length} module{cat.modules.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="ra-edit-grid">
                      {cat.modules.map((mod) => {
                        const p = draft?.[mod.id] || { enabled: false, actions: {} };
                        return (
                          <div key={mod.id} className={`ra-edit-card ${p.enabled ? '' : 'disabled'}`}>
                            <div className="ra-edit-card-head">
                              <strong>{mod.label}</strong>
                              <Toggle
                                on={!!p.enabled}
                                onChange={(v) => setModuleEnabled(mod.id, v, mod.actions)}
                              />
                            </div>
                            <div className="ra-edit-actions">
                              {mod.actions.map((a) => (
                                <label key={a} className={`ra-mini-toggle ${p.actions?.[a] ? 'on' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={!!p.actions?.[a]}
                                    disabled={!p.enabled}
                                    onChange={() => {
                                      if (!p.enabled) return;
                                      toggleAction(mod.id, a, mod.actions);
                                    }}
                                  />
                                  <span>{actionLabel(actionLabels, a)}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                filteredCatalog.map((cat) => (
                  <section key={cat.category} className="ra-cat">
                    <div className="ra-cat-head">
                      <h4>{cat.category}</h4>
                      <span>{cat.modules.length} module{cat.modules.length === 1 ? '' : 's'}</span>
                    </div>
                    {cat.modules.map((mod) => {
                      const p = activePerms?.[mod.id];
                      const enabled = Boolean(p?.enabled && Object.values(p.actions || {}).some(Boolean));
                      return (
                        <div key={mod.id} className={`ra-row ${enabled ? '' : 'dim'}`}>
                          <div className="ra-row-left">
                            <span className={`ra-dot ${enabled ? 'on' : ''}`} />
                            <span>{mod.label}</span>
                          </div>
                          <div className="ra-row-actions">
                            {mod.actions.map((a) => (
                              <PermChip
                                key={a}
                                on={!!(p?.enabled && p.actions?.[a])}
                                label={actionLabel(actionLabels, a)}
                                locked={!!activeRole.locked}
                                editing={false}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))
              )}
              {!filteredCatalog.length ? (
                <p className="muted" style={{ padding: 16 }}>No modules match this filter.</p>
              ) : null}
            </div>

            <div className="ra-modal-foot">
              {activeRole.locked ? (
                <span className="ra-locked-note">🔒 Admin permissions are system-managed and locked.</span>
              ) : editRole ? (
                <span className="muted">Toggle modules and button-level actions, then save.</span>
              ) : (
                <span className="muted">Read-only permissions inspector.</span>
              )}
              <div className="ra-foot-actions">
                <button type="button" className="btn secondary" onClick={closeModals}>
                  Close
                </button>
                {!activeRole.locked && !editRole ? (
                  <button type="button" className="btn" onClick={() => openEdit(activeRole)}>
                    ✎ Edit Permissions
                  </button>
                ) : null}
                {editRole ? (
                  <button type="button" className="btn" disabled={saving} onClick={saveEdit}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showNew ? (
        <div className="ra-modal-backdrop" onClick={() => !saving && setShowNew(false)}>
          <div className="us-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>New Role</h3>
            <form className="us-create-form" onSubmit={createRole}>
              <label>
                Role name
                <input
                  className="input"
                  required
                  value={newForm.label}
                  onChange={(e) => setNewForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. CAPA Reviewer"
                />
              </label>
              <label>
                Description
                <textarea
                  className="input"
                  rows={3}
                  value={newForm.description}
                  onChange={(e) => setNewForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What this role can do"
                />
              </label>
              <div className="us-modal-actions">
                <button type="button" className="btn secondary" disabled={saving} onClick={() => setShowNew(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
