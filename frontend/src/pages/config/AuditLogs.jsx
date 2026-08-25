import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function AuditLogs() {
  const [q, setQ] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (moduleFilter !== 'all') params.set('module', moduleFilter);
    if (q.trim()) params.set('q', q.trim());
    api
      .get(`/audit-logs?${params.toString()}`)
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
  }, [q, moduleFilter]);

  const modules = useMemo(() => {
    const set = new Set(logs.map((row) => row.module).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [logs]);

  const stats = useMemo(() => {
    const blocked = logs.filter((row) => row.status === 'BLOCKED').length;
    const users = new Set(logs.map((row) => row.user_email || row.user_name).filter(Boolean)).size;
    const newComplaint = logs.filter((row) => row.module === 'New Complaint').length;
    return { total: logs.length, blocked, users, newComplaint };
  }, [logs]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Audit Logs</h1>
          <p>Live trail of New Complaint actions, AI assist, and security events.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="card stat-card">
          <div className="value c-teal">{stats.total.toLocaleString()}</div>
          <div className="label">Loaded Events</div>
        </div>
        <div className="card stat-card">
          <div className="value c-amber">{stats.newComplaint}</div>
          <div className="label">New Complaint</div>
        </div>
        <div className="card stat-card">
          <div className="value c-red">{stats.blocked}</div>
          <div className="label">Blocked</div>
        </div>
        <div className="card stat-card">
          <div className="value c-teal">{stats.users}</div>
          <div className="label">Users (sample)</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="search-bar">
          <input
            className="input"
            placeholder="Search user, module, action, detail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            {modules.map((m) => (
              <option key={m} value={m}>
                {m === 'all' ? 'All modules' : m}
              </option>
            ))}
          </select>
          <span className="live-pill">• LIVE</span>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Live Audit Trail</h3>
          {loading ? <span className="muted">Loading…</span> : null}
        </div>
        {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User ID</th>
              <th>User</th>
              <th>Dept</th>
              <th>Module</th>
              <th>Action</th>
              <th>Detail</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!logs.length && !loading ? (
              <tr>
                <td colSpan={8} className="muted">
                  No audit events yet. Open New Complaint or submit a case to create logs.
                </td>
              </tr>
            ) : (
              logs.map((r) => (
                <tr key={r.id}>
                  <td>{formatTime(r.created_at)}</td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, maxWidth: 140, wordBreak: 'break-all' }} title={r.user_id || ''}>
                    {r.user_id || '—'}
                  </td>
                  <td>{r.user_name || r.user_email || '—'}</td>
                  <td>{r.dept || '—'}</td>
                  <td>{r.module}</td>
                  <td style={{ fontWeight: 700 }}>{r.action}</td>
                  <td>{r.detail || '—'}</td>
                  <td>
                    <span className={`badge ${r.status === 'ALLOWED' ? 'minor' : 'critical'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
