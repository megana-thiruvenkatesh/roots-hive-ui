import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

const DEFAULT_POLICIES = [
  {
    id: 'p1',
    name: 'Prompt Injection Detection',
    category: 'Security',
    priority: 'CRITICAL',
    enabled: true,
    condition: 'Prompt matches injection patterns (jailbreak, ignore previous instructions…)',
    action: 'Block immediately + audit log + notify security team',
  },
  {
    id: 'p2',
    name: 'PII / Salary Data Guard',
    category: 'Security',
    priority: 'CRITICAL',
    enabled: true,
    condition: 'Query asks for salary, Aadhaar, personal contact dumps',
    action: 'Block + audit log',
  },
  {
    id: 'p3',
    name: 'Department Scope Access',
    category: 'Access',
    priority: 'HIGH',
    enabled: true,
    condition: 'User queries outside assigned department knowledge',
    action: 'Allow only matched dept documents',
  },
  {
    id: 'p4',
    name: 'LLM Temperature Cap',
    category: 'AI/LLM',
    priority: 'HIGH',
    enabled: true,
    condition: 'Model temperature requested above 1.0',
    action: 'Clamp to 0.7 and continue',
  },
  {
    id: 'p5',
    name: 'Retention Compliance',
    category: 'Compliance',
    priority: 'HIGH',
    enabled: true,
    condition: 'Chat older than retention window',
    action: 'Auto-archive + restrict export',
  },
];

const TABS = ['Security', 'Access', 'AI/LLM', 'Compliance'];

export default function PolicyConfig() {
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [tab, setTab] = useState('Security');
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get('/settings/policy_config')
      .then((d) => {
        if (Array.isArray(d.value?.policies) && d.value.policies.length) {
          setPolicies(d.value.policies);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return policies.filter((p) => {
      if (p.category !== tab) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return `${p.name} ${p.condition} ${p.action}`.toLowerCase().includes(s);
    });
  }, [policies, tab, q]);

  const counts = useMemo(() => {
    const c = { Total: policies.length, Active: 0, Disabled: 0, Critical: 0 };
    policies.forEach((p) => {
      if (p.enabled) c.Active += 1;
      else c.Disabled += 1;
      if (p.priority === 'CRITICAL') c.Critical += 1;
    });
    return c;
  }, [policies]);

  function toggle(id) {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
    setSaved(false);
  }

  function remove(id) {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    setSaved(false);
  }

  function addPolicy() {
    const id = `p${Date.now()}`;
    setPolicies((prev) => [
      {
        id,
        name: 'New Policy',
        category: tab,
        priority: 'HIGH',
        enabled: true,
        condition: 'Describe trigger condition…',
        action: 'Describe enforcement action…',
      },
      ...prev,
    ]);
    setSaved(false);
  }

  async function save() {
    await api.put('/settings/policy_config', { policies });
    setSaved(true);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Policy Configuration</h1>
          <p>Live rules engine — changes take effect immediately on next query.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={addPolicy}>
            + New Policy
          </button>
          <button className="btn" onClick={save}>
            Save Policies
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="card stat-card">
          <div className="value c-teal">{counts.Total}</div>
          <div className="label">Total</div>
        </div>
        <div className="card stat-card">
          <div className="value c-teal">{counts.Active}</div>
          <div className="label">Active</div>
        </div>
        <div className="card stat-card">
          <div className="value">{counts.Disabled}</div>
          <div className="label">Disabled</div>
        </div>
        <div className="card stat-card">
          <div className="value c-red">{counts.Critical}</div>
          <div className="label">Critical</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Search policies..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chip-row">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t} ({policies.filter((p) => p.category === t).length})
            </button>
          ))}
        </div>
      </div>

      <div className="stack">
        {filtered.map((p) => (
          <div key={p.id} className="card policy-card">
            <div className="policy-top">
              <label className="toggle">
                <input type="checkbox" checked={p.enabled} onChange={() => toggle(p.id)} />
                <span />
              </label>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{p.name}</div>
              </div>
              <span className={`badge ${p.priority === 'CRITICAL' ? 'critical' : 'major'}`}>
                {p.priority}
              </span>
              <button className="btn secondary" style={{ padding: '6px 10px' }} onClick={() => remove(p.id)}>
                Del
              </button>
            </div>
            <div className="policy-grid">
              <div className="result-box">
                <div className="muted" style={{ fontWeight: 800, marginBottom: 4 }}>
                  CONDITION
                </div>
                {p.condition}
              </div>
              <div className="result-box">
                <div className="muted" style={{ fontWeight: 800, marginBottom: 4 }}>
                  ACTION
                </div>
                <span className="c-amber">{p.action}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="muted">No policies in this category.</p>}
      </div>
      {saved && <p className="muted" style={{ marginTop: 10 }}>Saved</p>}
    </div>
  );
}
