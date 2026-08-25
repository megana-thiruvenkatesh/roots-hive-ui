import React, { useMemo, useState } from 'react';
import { defectOptions } from '../../lib/aiEngineStub';
import {
  EngineAiPanel,
  EngineHistoricPanel,
  TypeSourceSelect,
  useEngineAssist,
} from './EngineAssist.jsx';

export default function SmartDiagnostic() {
  const defects = useMemo(() => defectOptions(), []);
  const [type, setType] = useState('Internal');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');

  const filtered = defects.filter((d) => d.toLowerCase().includes(query.toLowerCase()));

  const assist = useEngineAssist({
    type,
    description: selected,
    defectCat: selected,
    part: '',
    mode: 'diagnostic',
  });

  function selectDefect(d) {
    setSelected(d);
  }

  return (
    <div className="engine-page engine-assist-page">
      <div className="engine-head">
        <h1>Smart Diagnostic Engine</h1>
      </div>

      <div className="engine-assist-row">
        <section className="result-card-section">
          <div className="outside-card-title">1. Diagnostic Input</div>
          <div className="card nc-card engine-side-card">
            <TypeSourceSelect value={type} onChange={setType} />
            <div className="field">
              <label>Search defect</label>
              <input
                className="input"
                placeholder="e.g. leakage, crack, porosity..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="chip-row">
              {filtered.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${selected === d ? 'active' : ''}`}
                  onClick={() => selectDefect(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            {!selected ? (
              <p className="muted" style={{ marginTop: 12 }}>
                Select a defect category to generate historic matches and an AI solution.
              </p>
            ) : (
              <p className="diagnostic-selection">
                Selected defect: <strong>{selected}</strong>
              </p>
            )}
          </div>
        </section>

        <EngineHistoricPanel
          type={type}
          matches={assist.matches}
          matching={assist.matching}
          ready={assist.ready}
          expanded={assist.expanded}
          setExpanded={assist.setExpanded}
        />

        <EngineAiPanel
          type={type}
          ready={assist.ready}
          busy={assist.busy}
          chat={assist.chat}
          sendChat={assist.sendChat}
          pendingFiles={assist.pendingFiles}
          setPendingFiles={assist.setPendingFiles}
        />
      </div>
    </div>
  );
}
