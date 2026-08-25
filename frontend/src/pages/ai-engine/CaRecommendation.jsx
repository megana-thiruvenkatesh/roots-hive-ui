import React, { useState } from 'react';
import { defectOptions } from '../../lib/aiEngineStub';
import {
  EngineAiPanel,
  EngineHistoricPanel,
  TypeSourceSelect,
  useEngineAssist,
} from './EngineAssist.jsx';

export default function CaRecommendation() {
  const [type, setType] = useState('Internal');
  const [defectCategory, setDefectCategory] = useState('Leakage');
  const [rootCause, setRootCause] = useState('');
  const [complaintText, setComplaintText] = useState('');

  const assist = useEngineAssist({
    type,
    description: [complaintText, rootCause].filter(Boolean).join(' · '),
    defectCat: defectCategory,
    part: '',
    mode: 'ca',
  });

  return (
    <div className="engine-page engine-assist-page">
      <div className="engine-head">
        <h1>CAPA</h1>
      </div>

      <div className="engine-assist-row">
        <section className="result-card-section">
          <div className="outside-card-title">1. Action Input</div>
          <div className="card nc-card engine-side-card">
          <TypeSourceSelect value={type} onChange={setType} />
          <div className="field">
            <label>Defect Category</label>
            <select
              className="input"
              value={defectCategory}
              onChange={(e) => setDefectCategory(e.target.value)}
            >
              {defectOptions().map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Root Cause</label>
            <input
              className="input"
              placeholder="e.g. Internal shrinkage porosity"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Complaint Description</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe the complaint for better matching…"
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
            />
          </div>
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
