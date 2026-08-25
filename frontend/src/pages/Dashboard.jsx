import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

const CHART_COLORS = [
  '#176b52', // brand green (roots-hive)
  '#2f64c5', // blue
  '#a35d12', // amber
  '#e11d48', // rose
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#f97316', // orange
  '#14b8a6', // teal accent
];

const METRIC_ICONS = {
  total: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M10 19V9" />
      <path d="M16 19v-6" />
      <path d="M22 19H2" />
    </svg>
  ),
  open: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  critical: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const load = useCallback(() => {
    api
      .get('/dashboard/stats')
      .then((d) => {
        setError('');
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const previewItems = useMemo(() => {
    if (!data || !preview) return [];
    const items = data.items || [];
    if (preview.kind === 'stage') {
      return items.filter((c) => (c.stage || 'Unknown') === preview.key);
    }
    return items.filter((c) => (c.defectCat || 'Uncategorized') === preview.key);
  }, [data, preview]);

  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  const { stats, byStage, byCategory, recent } = data;
  const firstName = String(user?.name || 'there').split(/\s+/)[0];

  return (
    <div className="dash-page">
      <section className="dash-welcome-banner">
        <p className="dash-kicker">Dashboard</p>
        <h1>Welcome, {firstName}!</h1>
      </section>

      <div className="dash-metric-grid">
        <MetricCard
          label="Total Cases"
          value={stats.total}
          icon={METRIC_ICONS.total}
          hint={`${stats.closed || 0} closed`}
          tone="blue"
        />
        <MetricCard
          label="Open"
          value={stats.open}
          icon={METRIC_ICONS.open}
          hint={`${stats.myOpen || 0} assigned to you`}
          tone="teal"
        />
        <MetricCard
          label="Critical"
          value={stats.critical}
          icon={METRIC_ICONS.critical}
          hint="Needs attention"
          tone="rose"
        />
        <MetricCard
          label="Pending Approval"
          value={stats.pendingApproval}
          icon={METRIC_ICONS.pending}
          hint="Awaiting action"
          tone="amber"
        />
      </div>

      {preview ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>
              Preview · {preview.label} ({previewItems.length})
            </h3>
            <button type="button" className="btn secondary" onClick={() => setPreview(null)}>
              Clear
            </button>
          </div>
          <ComplaintPreviewList items={previewItems} empty="No complaints for this selection." />
        </div>
      ) : null}

      <div className="two-col">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Recent CAPA Activity</h3>
            <Link to="/complaints" className="muted" style={{ fontWeight: 700 }}>
              View all →
            </Link>
          </div>
          <ComplaintPreviewList items={recent} empty="No cases yet." />
        </div>

        <div className="stack">
          <div className="card dash-chart-card">
            <h3>By Stage</h3>
            <DonutChart
              data={byStage}
              activeKey={preview?.kind === 'stage' ? preview.key : null}
              onSelect={(key) =>
                setPreview((prev) =>
                  prev?.kind === 'stage' && prev.key === key
                    ? null
                    : { kind: 'stage', key, label: `Stage · ${key}` }
                )
              }
            />
          </div>
          <div className="card dash-chart-card">
            <h3>By Defect</h3>
            <BarChart
              data={byCategory}
              activeKey={preview?.kind === 'defect' ? preview.key : null}
              onSelect={(key) =>
                setPreview((prev) =>
                  prev?.kind === 'defect' && prev.key === key
                    ? null
                    : { kind: 'defect', key, label: `Defect · ${key}` }
                )
              }
            />
          </div>
          <RoleHints />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, hint, tone }) {
  return (
    <article className={`dash-metric-card tone-${tone || 'blue'}`}>
      <div className="dash-metric-top">
        <span className="dash-metric-label">{label}</span>
        <span className="dash-metric-icon">{icon}</span>
      </div>
      <div className="dash-metric-value">{value}</div>
      {hint ? <div className="dash-metric-hint">{hint}</div> : null}
    </article>
  );
}

function ComplaintPreviewList({ items, empty }) {
  if (!items?.length) return <p className="muted">{empty}</p>;
  return (
    <div className="stack">
      {items.map((c) => (
        <Link key={c.id} to={`/complaints/${c.id}`} className="row-link card" style={{ padding: '12px 14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
              {c.id} — {c.desc?.slice(0, 64)}
            </div>
            <div className="muted">
              {c.part || '—'} · {c.defectCat || '—'} · {c.assignedName || 'Unassigned'}
            </div>
          </div>
          <span className={`badge ${severityClass(c.severity)}`}>{c.severity}</span>
          <span className={`badge ${c.stage === 'Closed' ? 'closed' : 'open'}`}>{c.stage}</span>
        </Link>
      ))}
    </div>
  );
}

function DonutChart({ data = {}, activeKey, onSelect }) {
  const entries = Object.entries(data).filter(([, n]) => Number(n) > 0);
  const total = entries.reduce((sum, [, n]) => sum + Number(n), 0);

  if (!total) {
    return <p className="muted">No data</p>;
  }

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 72;
  const stroke = 28;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const slices = entries.map(([label, value], idx) => {
    const pct = Number(value) / total;
    const length = pct * c;
    const slice = {
      label,
      value: Number(value),
      pct,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      dasharray: `${length} ${c - length}`,
      dashoffset: -offset,
    };
    offset += length;
    return slice;
  });

  return (
    <div className="dash-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="dash-donut">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={stroke} />
        {slices.map((s) => (
          <circle
            key={s.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={activeKey && activeKey !== s.label ? stroke - 4 : stroke}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
            className="dash-donut-slice"
            opacity={activeKey && activeKey !== s.label ? 0.35 : 1}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect?.(s.label)}
          >
            <title>
              {s.label}: {s.value} ({Math.round(s.pct * 100)}%)
            </title>
          </circle>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="dash-donut-total">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="dash-donut-sub">
          CASES
        </text>
      </svg>
      <div className="dash-donut-legend">
        {slices.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`dash-legend-item${activeKey === s.label ? ' active' : ''}`}
            onClick={() => onSelect?.(s.label)}
          >
            <i style={{ background: s.color }} />
            <span className="dash-legend-label">{s.label}</span>
            <strong>{s.value}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data = {}, activeKey, onSelect }) {
  const entries = Object.entries(data)
    .filter(([, n]) => Number(n) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const max = entries.reduce((m, [, n]) => Math.max(m, Number(n)), 0);

  if (!entries.length) {
    return <p className="muted">No data</p>;
  }

  return (
    <div className="dash-bar-chart">
      {entries.map(([label, value], idx) => {
        const n = Number(value);
        const pct = max ? Math.round((n / max) * 100) : 0;
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        const active = activeKey === label;
        return (
          <button
            key={label}
            type="button"
            className={`dash-bar-row${active ? ' active' : ''}`}
            onClick={() => onSelect?.(label)}
            title={`${label}: ${n}`}
          >
            <span className="dash-bar-label">{label}</span>
            <span className="dash-bar-track">
              <span
                className="dash-bar-fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </span>
            <strong className="dash-bar-value">{n}</strong>
          </button>
        );
      })}
    </div>
  );
}

function RoleHints() {
  const items = [
    'Monitor open and critical CAPA cases',
    'Click stage / defect charts to preview matching complaints',
    'Use AI Chat and analysis for quality guidance',
  ];
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Your Focus</h3>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text2)', fontSize: 13.5, lineHeight: 1.6 }}>
        {items.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

function severityClass(s) {
  if (s === 'Critical') return 'critical';
  if (s === 'Major') return 'major';
  if (s === 'Minor') return 'minor';
  return '';
}
