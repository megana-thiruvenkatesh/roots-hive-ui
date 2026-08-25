import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { defectOptions } from '../../lib/aiEngineStub';

const CHIPS = [
  'Leakage',
  'Porosity',
  'Crack',
  'Dimensional Deviation',
  'Surface Finish',
  'Critical',
  'Die Casting',
  'Machining',
  'Closed',
];

export default function Search() {
  const [q, setQ] = useState('');
  const [defectCat, setDefectCat] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [stage, setStage] = useState('All');
  const [year, setYear] = useState('All');
  const [process, setProcess] = useState('All');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function run(overrides = {}) {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        q: overrides.q ?? q,
        defectCat: overrides.defectCat ?? defectCat,
        severity: overrides.severity ?? severity,
        stage: overrides.stage ?? stage,
        year: overrides.year ?? year,
        process: overrides.process ?? process,
      });
      const data = await api.get(`/complaints/search?${params}`);
      setResults(data.complaints);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQ('');
    setDefectCat('All');
    setSeverity('All');
    setStage('All');
    setYear('All');
    setProcess('All');
    setResults([]);
    setSearched(false);
  }

  function onChip(chip) {
    if (chip === 'Critical') {
      setSeverity('Critical');
      run({ severity: 'Critical' });
      return;
    }
    if (chip === 'Closed') {
      setStage('Closed');
      run({ stage: 'Closed' });
      return;
    }
    if (['Die Casting', 'Machining'].includes(chip)) {
      setProcess(chip);
      run({ process: chip });
      return;
    }
    setDefectCat(chip);
    setQ(chip);
    run({ defectCat: chip, q: chip });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Search CAPA History</h1>
          <p>
            Search across all complaints, root causes, corrective actions, Why-why analysis and
            attachments.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="search-bar">
          <input
            className="input"
            placeholder="Search by ID, defect, root cause, part, customer, corrective action..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
          <button className="btn" onClick={() => run()} disabled={loading}>
            {loading ? '…' : 'Search'}
          </button>
          <button className="btn secondary" type="button" onClick={clear}>
            Clear
          </button>
        </div>

        <div className="chip-row">
          {CHIPS.map((c) => (
            <button key={c} type="button" className="chip" onClick={() => onChip(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="form-grid-3" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Defect</label>
            <select className="input" value={defectCat} onChange={(e) => setDefectCat(e.target.value)}>
              <option>All</option>
              {defectOptions().map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Severity</label>
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {['All', 'Critical', 'Major', 'Minor', 'Observation'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Stage</label>
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
              {['All', 'Open', 'RCA', 'CAPA', 'Verification', 'Closed'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
              {['All', '2026', '2025', '2024'].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Process</label>
            <select className="input" value={process} onChange={(e) => setProcess(e.target.value)}>
              {['All', 'Die Casting', 'Machining', 'Welding', 'Assembly', 'Paint Line'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Sort</label>
            <select className="input" defaultValue="Relevance">
              <option>Relevance</option>
              <option>Newest</option>
            </select>
          </div>
        </div>
      </div>

      {!searched ? (
        <div className="card empty-panel">
          <h3>Search CAPA History</h3>
          <p className="muted">
            Use keywords, filters or click a chip above to find previous issues, root causes and
            corrective actions.
          </p>
        </div>
      ) : (
        <div className="table-list">
          {results.map((c) => (
            <Link key={c.id} to={`/complaints/${c.id}`} className="card row-link">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {c.id} — {c.desc?.slice(0, 90)}
                </div>
                <div className="muted">
                  {c.defectCat} · {c.severity} · {c.stage} · {c.customer || '—'}
                </div>
              </div>
            </Link>
          ))}
          {!loading && results.length === 0 && <p className="muted">No matches.</p>}
        </div>
      )}
    </div>
  );
}
