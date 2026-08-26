import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

function formatStamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${dd}-${mm}-${yyyy} & ${time}`;
}

function formatTimeOnly(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'BLOCKED' || s === 'FAILED' || s === 'DENIED') return 'failed';
  if (s === 'ALLOWED' || s === 'SUCCESS') return 'success';
  return 'info';
}

function statusLabel(status) {
  const s = String(status || 'INFO').toUpperCase();
  if (s === 'ALLOWED') return 'SUCCESS';
  if (s === 'BLOCKED') return 'FAILED';
  return s;
}

function actionTag(action) {
  return String(action || 'event').toLowerCase().replace(/_/g, ' ');
}

function eventTitle(row) {
  const a = String(row.action || '').replace(/_/g, ' ');
  if (!a) return row.module || 'Event';
  return a.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ipOf(row) {
  return row?.meta?.ip || row?.meta?.ipAddress || row?.meta?.ip_address || '—';
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function TimelineIcon({ tone }) {
  if (tone === 'failed') {
    return (
      <span className={`al-tl-icon failed`} aria-hidden="true">!</span>
    );
  }
  if (tone === 'success') {
    return (
      <span className={`al-tl-icon success`} aria-hidden="true">↵</span>
    );
  }
  return <span className={`al-tl-icon info`} aria-hidden="true">◈</span>;
}

function exportCsv(rows) {
  const headers = ['Timestamp', 'User ID', 'User', 'Email', 'Action', 'Resource', 'Details', 'Status', 'IP'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const cols = [
      formatStamp(r.created_at),
      r.user_id || '',
      r.user_name || '',
      r.user_email || '',
      r.action || '',
      r.module || '',
      r.detail || '',
      r.status || '',
      ipOf(r),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cols.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogs() {
  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewUserKey, setViewUserKey] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    api
      .get(`/audit-logs?${params.toString()}&limit=300`)
      .then((data) => {
        if (!cancelled) setLogs(data.logs || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const actions = useMemo(() => {
    const set = new Set(logs.map((r) => r.action).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [logs]);

  const resources = useMemo(() => {
    const set = new Set(logs.map((r) => r.module).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false;
      if (resourceFilter !== 'all' && r.module !== resourceFilter) return false;
      return true;
    });
  }, [logs, actionFilter, resourceFilter]);

  const userTimeline = useMemo(() => {
    if (!viewUserKey) return [];
    return logs
      .filter((r) => (r.user_id || r.user_email || r.user_name || 'unknown') === viewUserKey)
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [logs, viewUserKey]);

  const viewMeta = useMemo(() => {
    const first = userTimeline[0] || filtered.find((r) => (r.user_id || r.user_email || r.user_name) === viewUserKey);
    return {
      userId: first?.user_id || '—',
      name: first?.user_email || first?.user_name || 'Unknown user',
      total: userTimeline.length,
    };
  }, [userTimeline, filtered, viewUserKey]);

  function openView(row) {
    const key = row.user_id || row.user_email || row.user_name || 'unknown';
    setViewUserKey(key);
    setExpanded({ [row.id]: true });
  }

  function expandAll() {
    const next = {};
    userTimeline.forEach((r) => {
      next[r.id] = true;
    });
    setExpanded(next);
  }

  function collapseAll() {
    setExpanded({});
  }

  return (
    <div className="al-page">
      <div className="al-head">
        <div className="al-title-wrap">
          <span className="al-title-icon"><ClockIcon /></span>
          <h2 className="al-title">Audit Logs</h2>
        </div>
        <button type="button" className="al-export-btn" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
          <ExportIcon />
          Export Logs
        </button>
      </div>

      <div className="al-toolbar">
        <div className="al-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search logs..."
          />
        </div>
        <select
          className="al-select"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter by action"
        >
          {actions.map((a) => (
            <option key={a} value={a}>{a === 'all' ? 'All Actions' : a}</option>
          ))}
        </select>
        <select
          className="al-select"
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          aria-label="Filter by resource"
        >
          {resources.map((m) => (
            <option key={m} value={m}>{m === 'all' ? 'All Resources' : m}</option>
          ))}
        </select>
      </div>

      {error ? <p className="al-error">{error}</p> : null}

      <div className="al-table-wrap">
        <table className="al-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="al-empty">Loading…</td></tr>
            ) : !filtered.length ? (
              <tr>
                <td colSpan={6} className="al-empty">
                  No audit events yet. Open New Complaint or manage users to create logs.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="al-mono">{formatStamp(r.created_at)}</td>
                  <td>
                    <div className="al-user-cell">
                      <strong>{r.user_name || '—'}</strong>
                      <span>{r.user_email || r.user_id || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <span className="al-action-pill" title={r.detail || r.action}>
                      {actionTag(r.action)}
                    </span>
                  </td>
                  <td>{r.module || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="al-eye-btn"
                      title="View audit trail"
                      aria-label="View audit trail"
                      onClick={() => openView(r)}
                    >
                      <EyeIcon />
                    </button>
                  </td>
                  <td className="al-mono">{ipOf(r)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewUserKey ? (
        <div className="al-modal-backdrop" onClick={() => setViewUserKey(null)}>
          <div className="al-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="al-modal-head">
              <h3>View Audit Log</h3>
              <button type="button" className="al-close" onClick={() => setViewUserKey(null)} aria-label="Close">×</button>
            </div>

            <div className="al-user-summary">
              <div>
                <span className="al-k">User ID</span>
                <strong className="al-id">{viewMeta.userId}</strong>
              </div>
              <div>
                <span className="al-k">Actioner Name</span>
                <strong>{viewMeta.name}</strong>
              </div>
              <div>
                <span className="al-k">Total Events</span>
                <strong>{viewMeta.total}</strong>
              </div>
            </div>

            <div className="al-tl-tools">
              <button type="button" className="al-tl-tool active" onClick={expandAll}>Expand All</button>
              <button type="button" className="al-tl-tool" onClick={collapseAll}>Collapse All</button>
            </div>

            <div className="al-timeline">
              {!userTimeline.length ? (
                <p className="muted">No events for this user.</p>
              ) : (
                userTimeline.map((r) => {
                  const tone = statusTone(r.status);
                  const open = Boolean(expanded[r.id]);
                  const meta = r.meta && typeof r.meta === 'object' ? r.meta : {};
                  const metaEntries = Object.entries(meta).filter(([, v]) => v != null && v !== '');
                  return (
                    <div key={r.id} className={`al-tl-item ${open ? 'open' : ''}`}>
                      <div className="al-tl-rail">
                        <TimelineIcon tone={tone} />
                        <span className="al-tl-line" />
                      </div>
                      <div className="al-tl-time">{formatTimeOnly(r.created_at)}</div>
                      <div className="al-tl-card">
                        <button
                          type="button"
                          className="al-tl-card-head"
                          onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        >
                          <div>
                            <div className="al-tl-title-row">
                              <strong>{eventTitle(r)}</strong>
                              <span className={`al-status ${tone}`}>{statusLabel(r.status)}</span>
                            </div>
                            <p>{r.detail || `${r.module || 'System'} · ${r.action || 'event'}`}</p>
                          </div>
                          <span className="al-chevron">{open ? '▴' : '▾'}</span>
                        </button>
                        {open ? (
                          <div className="al-tl-details">
                            <div><span>Module</span><strong>{r.module || '—'}</strong></div>
                            <div><span>Action</span><strong>{r.action || '—'}</strong></div>
                            <div><span>Status</span><strong>{r.status || '—'}</strong></div>
                            <div><span>Dept</span><strong>{r.dept || '—'}</strong></div>
                            <div><span>User ID</span><strong className="al-id">{r.user_id || '—'}</strong></div>
                            <div><span>IP</span><strong>{ipOf(r)}</strong></div>
                            {metaEntries.map(([k, v]) => (
                              <div key={k}>
                                <span>{k}</span>
                                <strong>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="al-modal-foot">
              <button type="button" className="btn secondary" onClick={() => setViewUserKey(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
