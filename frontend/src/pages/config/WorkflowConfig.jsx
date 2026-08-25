import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

const DEFAULT_STAGES = [
  'Raised',
  'Initial Review',
  'Containment Action',
  'CFT Assignment',
  'AI Analysis',
  'Root Cause Finalization',
  'Corrective Action',
  'Preventive Action',
  'Approval',
  'Effectiveness Monitoring',
];

const DEFAULT = {
  approvalLevels: [
    { level: 1, role: 'Quality Lead', actionLabel: 'Technical Review', required: 'Required' },
    { level: 2, role: 'CFT Lead', actionLabel: 'CFT Sign-off', required: 'Required' },
    { level: 3, role: 'Quality Head', actionLabel: 'Quality Approval', required: 'Required' },
    { level: 4, role: 'Plant Manager', actionLabel: 'Management Approval', required: 'Optional' },
  ],
  stageDueDays: {
    Raised: 1,
    'Initial Review': 2,
    'Containment Action': 3,
    'CFT Assignment': 1,
    'AI Analysis': 2,
    'Root Cause Finalization': 5,
    'Corrective Action': 7,
    'Preventive Action': 10,
    Approval: 3,
    'Effectiveness Monitoring': 90,
  },
};

export default function WorkflowConfig() {
  const [cfg, setCfg] = useState(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/settings/workflow_config')
      .then((d) => {
        if (d.value && Object.keys(d.value).length) {
          setCfg((p) => ({
            ...p,
            ...d.value,
            approvalLevels: d.value.approvalLevels || p.approvalLevels,
            stageDueDays: { ...p.stageDueDays, ...(d.value.stageDueDays || {}) },
          }));
        }
      })
      .catch(() => {});
  }, []);

  function updLevel(idx, key, value) {
    setCfg((p) => {
      const next = [...(p.approvalLevels || [])];
      next[idx] = { ...next[idx], [key]: value };
      return { ...p, approvalLevels: next };
    });
    setSaved(false);
  }

  function addLevel() {
    setCfg((p) => ({
      ...p,
      approvalLevels: [
        ...(p.approvalLevels || []),
        {
          level: (p.approvalLevels?.length || 0) + 1,
          role: 'New Role',
          actionLabel: 'Review',
          required: 'Required',
        },
      ],
    }));
    setSaved(false);
  }

  function removeLevel(idx) {
    setCfg((p) => ({
      ...p,
      approvalLevels: (p.approvalLevels || [])
        .filter((_, i) => i !== idx)
        .map((row, i) => ({ ...row, level: i + 1 })),
    }));
    setSaved(false);
  }

  function updDue(stage, days) {
    setCfg((p) => ({
      ...p,
      stageDueDays: { ...(p.stageDueDays || {}), [stage]: Number(days) || 0 },
    }));
    setSaved(false);
  }

  async function save() {
    setError('');
    try {
      await api.put('/settings/workflow_config', cfg);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  }

  const stages = Object.keys(cfg.stageDueDays || {}).length
    ? Object.keys(cfg.stageDueDays)
    : DEFAULT_STAGES;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Workflow Configuration</h1>
          <p>Configure approval hierarchy and stage due days — applies to all new complaints.</p>
        </div>
        <button className="btn" onClick={save}>
          Save Config
        </button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Approval Hierarchy</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Lvl</th>
              <th>Role</th>
              <th>Action Label</th>
              <th>Required</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(cfg.approvalLevels || []).map((row, idx) => (
              <tr key={row.level}>
                <td>L{row.level}</td>
                <td>
                  <input
                    className="input"
                    value={row.role}
                    onChange={(e) => updLevel(idx, 'role', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    value={row.actionLabel}
                    onChange={(e) => updLevel(idx, 'actionLabel', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className="input"
                    value={row.required}
                    onChange={(e) => updLevel(idx, 'required', e.target.value)}
                  >
                    <option>Required</option>
                    <option>Optional</option>
                  </select>
                </td>
                <td>
                  <button className="btn danger" style={{ padding: '6px 10px' }} onClick={() => removeLevel(idx)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={addLevel}>
          + Add Level
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Stage Due Days</h3>
        <p className="muted">Default days allowed per stage</p>
        <div className="due-grid">
          {stages.map((stage) => (
            <div key={stage} className="due-card">
              <div className="due-title">{stage}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={cfg.stageDueDays?.[stage] ?? 0}
                  onChange={(e) => updDue(stage, e.target.value)}
                />
                <span className="muted">days</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
      {saved && <p className="muted">Saved</p>}
    </div>
  );
}
