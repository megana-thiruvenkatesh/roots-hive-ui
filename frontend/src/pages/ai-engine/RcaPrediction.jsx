import React, { useState } from 'react';
import { defectOptions } from '../../lib/aiEngineStub';
import {
  EngineAiPanel,
  EngineHistoricPanel,
  TypeSourceSelect,
  useEngineAssist,
} from './EngineAssist.jsx';

export default function RcaPrediction() {
  const [type, setType] = useState('Internal');
  const [defectCategory, setDefectCategory] = useState('Leakage');
  const [partDetails, setPartDetails] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [processParams, setProcessParams] = useState('');

  const assist = useEngineAssist({
    type,
    description: [complaintText, processParams].filter(Boolean).join(' · '),
    defectCat: defectCategory,
    part: partDetails,
    mode: 'rca',
  });

  return (
    <div className="engine-page engine-assist-page">
      <div className="engine-head">
        <h1>AI Root Cause Prediction</h1>
      </div>

      <div className="engine-assist-row">
        <section className="result-card-section">
          <div className="outside-card-title">1. Complaint Details</div>
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
            <label>Part Details</label>
            <input
              className="input"
              placeholder="Part name, code, material..."
              value={partDetails}
              onChange={(e) => setPartDetails(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Complaint Text</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe the complaint in detail…"
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Process Parameters (optional)</label>
            <input
              className="input"
              placeholder="e.g. Die Casting, Die Temp 680°C..."
              value={processParams}
              onChange={(e) => setProcessParams(e.target.value)}
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
