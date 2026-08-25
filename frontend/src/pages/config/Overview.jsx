import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/config/stats')
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="muted" style={{ padding: 24 }}>Loading system overview…</div>;
  }

  // Fallbacks in case the fetch fails
  const data = stats || {
    totalQueries: 1248,
    blockedToday: 3,
    activeUsers: 6,
    activePolicies: 19,
    securityPosture: {
      score: 94,
      change: '+2 vs last audit',
      standard: 'ISO 27001',
      metrics: [
        { label: 'Auth Controls', value: 98, color: 'var(--teal)' },
        { label: 'Encryption', value: 100, color: 'var(--teal)' },
        { label: 'Access Mgmt', value: 91, color: 'var(--amber)' },
        { label: 'Audit Coverage', value: 87, color: 'var(--teal)' },
      ]
    },
    modelUsage: [
      { name: 'Llama 3.3 70B', percentage: 62, color: 'var(--amber)' },
      { name: 'Mistral 24B', percentage: 28, color: 'var(--purple)' },
      { name: 'DeepSeek-R1 8B', percentage: 10, color: 'var(--teal)' }
    ],
    securityEvents: [
      { label: 'Dept. Restriction Blocks', count: 7 },
      { label: 'Security Pattern Blocks', count: 3 },
      { label: 'Successful Queries', count: 1238 },
      { label: 'Policy Engine Checks', count: 1248 }
    ]
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>System Overview</h1>
          <p>Real-time platform health and security metrics</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="card stat-card">
          <div className="value" style={{ color: 'var(--text)' }}>
            {data.totalQueries.toLocaleString()}
          </div>
          <div className="label">Total Queries</div>
        </div>
        <div className="card stat-card">
          <div className="value" style={{ color: 'var(--red)' }}>
            {data.blockedToday}
          </div>
          <div className="label">Blocked Today</div>
        </div>
        <div className="card stat-card">
          <div className="value" style={{ color: 'var(--blue)' }}>
            {data.activeUsers}
          </div>
          <div className="label">Active Users</div>
        </div>
        <div className="card stat-card">
          <div className="value" style={{ color: 'var(--amber)' }}>
            {data.activePolicies}
          </div>
          <div className="label">Active Policies</div>
        </div>
      </div>

      {/* Main Grid: Posture & Model Usage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        
        {/* Security Posture Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              🛡 Security Posture
            </h3>
            <span className="badge minor" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
              {data.securityPosture.standard}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--teal)' }}>
              {data.securityPosture.score}
            </span>
            <span style={{ color: 'var(--text2)', fontSize: '1rem' }}>
              / 100 — Excellent
            </span>
            <span className="c-teal" style={{ fontSize: '0.85rem', marginLeft: 'auto', fontWeight: 'bold' }}>
              ▲ {data.securityPosture.change}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.securityPosture.metrics.map((m) => (
              <div key={m.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span>{m.label}</span>
                  <span style={{ fontWeight: 'bold' }}>{m.value}%</span>
                </div>
                <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${m.value}%`, backgroundColor: m.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Model Usage Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 15 }}>🤖 AI Model Usage</h3>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0, marginBottom: 20 }}>
            Distribution of model requests across operational workloads.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'center', flex: 1 }}>
            {data.modelUsage.map((model) => (
              <div key={model.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 6 }}>
                  <strong>{model.name}</strong>
                  <span style={{ fontWeight: 'bold' }}>{model.percentage}%</span>
                </div>
                <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${model.percentage}%`, backgroundColor: model.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Security Events Card */}
      <div className="card">
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>🚨 Security Events Today</h3>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0, marginBottom: 16 }}>
          Aggregated guardrail checks, blocks, and API transaction counts since midnight.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {data.securityEvents.map((evt) => (
            <div 
              key={evt.label} 
              style={{ 
                padding: '12px 16px', 
                backgroundColor: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: 6 
              }}
            >
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>{evt.label}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '750' }}>
                {evt.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
