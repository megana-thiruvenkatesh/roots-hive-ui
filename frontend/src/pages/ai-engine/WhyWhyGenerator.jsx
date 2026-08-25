import React, { useState } from 'react';
import { defectOptions } from '../../lib/aiEngineStub';
import { ANALYSIS_METHODS } from '../../lib/analysisMethods';
import {
  EngineAiPanel,
  EngineHistoricPanel,
  TypeSourceSelect,
  useEngineAssist,
} from './EngineAssist.jsx';

export default function WhyWhyGenerator() {
  const [type, setType] = useState('Internal');
  const [defectCategory, setDefectCategory] = useState('Leakage');
  const [rootCause, setRootCause] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [analysisMethod, setAnalysisMethod] = useState('why-why');

  const assist = useEngineAssist({
    type,
    description: [complaintText, rootCause].filter(Boolean).join(' · '),
    defectCat: defectCategory,
    part: '',
    mode: 'why-why',
    analysisMethod,
  });

  return (
    <div className="engine-page engine-assist-page">
      <div className="engine-head">
        <h1>Analysis</h1>
      </div>

      <div className="engine-assist-row">
        <section className="result-card-section">
          <div className="outside-card-title">1. Analysis Input</div>
          <div className="card nc-card engine-side-card">
            <TypeSourceSelect value={type} onChange={setType} />
            <div className="field">
              <label>Analysis Method</label>
              <div className="chip-row analysis-method-chips" style={{ marginTop: 6 }}>
                {ANALYSIS_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`chip ${analysisMethod === method.id ? 'active' : ''}`}
                    onClick={() => setAnalysisMethod(method.id)}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>
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
              <label>Root Cause (optional)</label>
              <input
                className="input"
                placeholder="Known or suspected root cause..."
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Complaint Text</label>
              <textarea
                className="input"
                rows={4}
                placeholder="Describe the complaint…"
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
          analysisMethod={analysisMethod}
        />

        <EngineAiPanel
          type={type}
          ready={assist.ready}
          busy={assist.busy}
          chat={assist.chat}
          sendChat={assist.sendChat}
          pendingFiles={assist.pendingFiles}
          setPendingFiles={assist.setPendingFiles}
          analysisMethod={analysisMethod}
        />
      </div>
    </div>
  );
}
