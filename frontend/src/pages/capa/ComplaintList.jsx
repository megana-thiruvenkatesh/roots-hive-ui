import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function ComplaintList() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [stage, setStage] = useState('All');
  const [severity, setSeverity] = useState('All');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/complaints')
      .then((d) => setComplaints(d.complaints))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      const text = `${c.id} ${c.desc} ${c.part} ${c.customer} ${c.defectCat} ${c.rootCause}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (type !== 'All' && c.type !== type) return false;
      if (stage !== 'All' && c.stage !== stage) return false;
      if (severity !== 'All' && c.severity !== severity) return false;
      return true;
    });
  }, [complaints, q, type, stage, severity]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>All Complaints ({filtered.length})</h1>
          <p>Search and filter live complaint records.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filter-row">
          <input
            className="input"
            placeholder="Search complaints, parts, customers, root causes..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {['All', 'Customer Complaint', 'Internal', 'Supplier', 'Process Issue', 'Complaint'].map(
              (t) => (
                <option key={t} value={t === 'All' ? 'All' : t}>
                  {t === 'All' ? 'All Types' : t}
                </option>
              )
            )}
          </select>
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            {['All', 'Draft', 'Pending Approval', 'Rejected', 'Approved', 'Open', 'RCA', 'CAPA', 'Verification', 'Closed'].map((s) => (
              <option key={s}>{s === 'All' ? 'All Stages' : s}</option>
            ))}
          </select>
          <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {['All', 'Critical', 'Major', 'Minor', 'Observation'].map((s) => (
              <option key={s}>{s === 'All' ? 'All Severity' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && !complaints.length ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Part</th>
                <th>Defect</th>
                <th>Sev</th>
                <th>Stage</th>
                <th>Qty</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/complaints/${c.id}`} style={{ color: 'var(--teal)', fontWeight: 700 }}>
                      {c.id}
                    </Link>
                  </td>
                  <td>{String(c.raisedDate).slice(0, 10)}</td>
                  <td>{c.type || '—'}</td>
                  <td>{c.customer || '—'}</td>
                  <td>{c.part || '—'}</td>
                  <td>{c.defectCat || '—'}</td>
                  <td>
                    <span className={`badge ${severityClass(c.severity)}`}>{c.severity}</span>
                  </td>
                  <td>
                    <span className={`badge ${c.stage === 'Closed' ? 'closed' : 'open'}`}>
                      {c.stage}
                    </span>
                  </td>
                  <td>{c.defectQty ?? '—'}</td>
                  <td>
                    <Link to={`/complaints/${c.id}`} className="btn secondary" style={{ padding: '6px 10px' }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="muted">No complaints found.</p>}
        </div>
      )}
    </div>
  );
}

function severityClass(s) {
  if (s === 'Critical') return 'critical';
  if (s === 'Major') return 'major';
  if (s === 'Minor') return 'minor';
  return '';
}
