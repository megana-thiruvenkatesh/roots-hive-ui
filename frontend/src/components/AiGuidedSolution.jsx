import React, { useState } from 'react';

const STEPS = [
  { id: 1, label: '1 · Generate' },
  { id: 2, label: '2 · Review' },
  { id: 3, label: '3 · Actions' },
];

function whyPairsFromSuggestion(suggestion, grounding) {
  const answers = Array.isArray(suggestion?.whyWhy)
    ? suggestion.whyWhy.map(String).filter(Boolean)
    : Array.isArray(grounding?.whyWhy)
      ? grounding.whyWhy.map(String).filter(Boolean)
      : [];
  if (!answers.length && grounding?.rootCause) answers.push(String(grounding.rootCause));
  if (!answers.length) {
    return [
      {
        question: 'Why did this defect occur?',
        answer: suggestion?.rootCause || grounding?.rootCause || '',
      },
    ];
  }
  return answers.map((answer, index) => ({
    question:
      index === 0
        ? `Why did this happen: "${String(suggestion?.symptom || grounding?.symptom || grounding?.description || 'the defect').slice(0, 80)}"?`
        : `Why did this happen: "${answers[index - 1]}"?`,
    answer,
  }));
}

function buildOptions(seed, kind) {
  const base = String(seed || '').trim();
  if (!base) {
    return [
      kind === 'ca'
        ? 'Adapt the selected historical corrective action to this complaint context.'
        : 'Introduce a mistake-proofed verification step for this failure mode.',
      kind === 'ca'
        ? 'Contain affected lots, rework or quarantine defects, and verify first-article checks.'
        : 'Update work instruction / control plan and train operators on the revised method.',
      kind === 'ca'
        ? 'Add an in-process detection checkpoint before the next value-adding step.'
        : 'Add layered process audit coverage for the confirmed root cause.',
    ];
  }
  return [
    `Adapt historical ${kind === 'ca' ? 'corrective' : 'preventive'} action: ${base}`,
    kind === 'ca'
      ? `Contain and correct based on: ${base}`
      : `Standardize and verify based on: ${base}`,
    kind === 'ca'
      ? `Add detection checkpoint aligned with: ${base}`
      : `Train and mistake-proof around: ${base}`,
  ];
}

/**
 * Guided AI Suggestions panel (Generate → Review → Actions).
 * No "Toggle focused view".
 */
export default function AiGuidedSolution({
  form,
  grounding,
  suggestion,
  busy,
  onGenerate,
  onApplyToForm,
}) {
  const [step, setStep] = useState(1);
  const [whyEntries, setWhyEntries] = useState([]);
  const [rootCause, setRootCause] = useState('');
  const [caOptions, setCaOptions] = useState([]);
  const [paOptions, setPaOptions] = useState([]);
  const [selectedCa, setSelectedCa] = useState(0);
  const [selectedPa, setSelectedPa] = useState(0);
  const [finalCa, setFinalCa] = useState('');
  const [finalPa, setFinalPa] = useState('');
  const [error, setError] = useState('');

  const depth = Math.max(2, Math.min(5, whyEntries.length || 4));

  async function handleGenerate() {
    setError('');
    if (!grounding?.id) {
      setError('Select one historic case as reference before generating.');
      return;
    }
    try {
      const data = await onGenerate?.();
      const nextSuggestion = data?.suggestion || suggestion || null;
      const pairs = whyPairsFromSuggestion(nextSuggestion, grounding);
      const rc = nextSuggestion?.rootCause || grounding?.rootCause || pairs[pairs.length - 1]?.answer || '';
      const caSeed = nextSuggestion?.correctiveAction || grounding?.correctiveAction || '';
      const paSeed = nextSuggestion?.preventiveAction || grounding?.preventiveAction || '';
      setWhyEntries(pairs);
      setRootCause(rc);
      setCaOptions(buildOptions(caSeed, 'ca'));
      setPaOptions(buildOptions(paSeed, 'pa'));
      setSelectedCa(0);
      setSelectedPa(0);
      setFinalCa(caSeed || '');
      setFinalPa(paSeed || '');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to generate AI suggestions');
    }
  }

  function updateWhy(index, key, value) {
    setWhyEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry))
    );
  }

  function confirmAnalysis() {
    const last = whyEntries[whyEntries.length - 1]?.answer?.trim();
    if (last) setRootCause(last);
    setStep(3);
  }

  function saveToForm() {
    onApplyToForm?.({
      rootCause: rootCause || whyEntries[whyEntries.length - 1]?.answer || '',
      whyWhyText: whyEntries.map((entry) => entry.answer).filter(Boolean).join('\n'),
      correctiveAction: finalCa || caOptions[selectedCa] || '',
      preventiveAction: finalPa || paOptions[selectedPa] || '',
    });
  }

  const groundingLabel = grounding?.id || null;

  return (
    <div className="ai-guide">
      <div className="ai-guide-stepper" aria-label="AI suggestion workflow">
        {STEPS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`ai-guide-step${step === entry.id ? ' active' : ''}${step > entry.id ? ' done' : ''}`}
            onClick={() => {
              if (entry.id === 1) setStep(1);
              else if (entry.id === 2 && whyEntries.length) setStep(2);
              else if (entry.id === 3 && whyEntries.length) setStep(3);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="ai-guide-stage">
        {step === 1 ? (
          <div className="ai-guide-panel">
            <h3>Generate grounded AI Suggestions</h3>
            <p className="ai-guide-copy">
              First select one retrieved historical case as ground truth. Its seeded Why-Why, root cause, CA, and PA drive Card 1 suggestions and this AI draft.
            </p>
            {groundingLabel ? (
              <div className="ai-guide-grounding ready">
                <div>
                  <strong>{groundingLabel}</strong>
                  <span>Selected historical grounding case</span>
                </div>
                <em>Ready</em>
              </div>
            ) : (
              <div className="ai-guide-grounding">
                <div>
                  <strong>No historical case selected</strong>
                  <span>Use Select as reference on a historic card.</span>
                </div>
                <em className="req">Required</em>
              </div>
            )}
            {error ? <p className="ai-guide-error">{error}</p> : null}
            <button type="button" className="ai-guide-primary" disabled={busy || !grounding?.id || !onGenerate} onClick={handleGenerate}>
              {busy ? 'Generating…' : 'Generate AI Suggestions'}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="ai-guide-panel">
            <div className="ai-guide-review-head">
              <h3>Complete Occurrence analysis</h3>
              <span className="ai-guide-depth">{depth} dynamic levels</span>
            </div>
            <p className="ai-guide-copy">
              {groundingLabel ? `Grounded in ${groundingLabel}. ` : ''}
              The wording describes how the defect was created in the process.
            </p>
            <div className="ai-why-chain">
              {whyEntries.map((entry, index) => (
                <div key={`why-${index}`} className="ai-why-step">
                  <div className="ai-why-num">{index + 1}</div>
                  <div className="ai-why-fields">
                    <label>Why question</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={entry.question}
                      onChange={(e) => updateWhy(index, 'question', e.target.value)}
                    />
                    <label>Answer</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={entry.answer}
                      onChange={(e) => updateWhy(index, 'answer', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="ai-guide-root">
              <strong>Confirmed root cause</strong>
              <span>{rootCause || whyEntries[whyEntries.length - 1]?.answer || '—'}</span>
            </div>
            <button type="button" className="ai-guide-primary" onClick={confirmAnalysis}>
              Confirm edited analysis & generate actions
            </button>
            <button type="button" className="ai-guide-secondary" disabled={busy || !onGenerate} onClick={handleGenerate}>
              Regenerate complete analysis
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="ai-guide-panel">
            <div className="ai-guide-root">
              <strong>Confirmed root cause</strong>
              <span>{rootCause || '—'}</span>
            </div>
            <div className="ai-guide-actions-grid">
              <div>
                <h3>Corrective-action options</h3>
                <p className="ai-guide-copy">Select an option, then edit it if needed.</p>
                <div className="ai-option-stack">
                  {caOptions.map((option, index) => (
                    <button
                      key={`ca-${index}`}
                      type="button"
                      className={`ai-option-card${selectedCa === index ? ' selected' : ''}`}
                      onClick={() => {
                        setSelectedCa(index);
                        setFinalCa(option);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <label>Final corrective action</label>
                <textarea className="input" rows={3} value={finalCa} onChange={(e) => setFinalCa(e.target.value)} placeholder="—" />
              </div>
              <div>
                <h3>Preventive-action options</h3>
                <p className="ai-guide-copy">Generated from the confirmed root cause.</p>
                <div className="ai-option-stack">
                  {paOptions.map((option, index) => (
                    <button
                      key={`pa-${index}`}
                      type="button"
                      className={`ai-option-card${selectedPa === index ? ' selected' : ''}`}
                      onClick={() => {
                        setSelectedPa(index);
                        setFinalPa(option);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <label>Final preventive action</label>
                <textarea className="input" rows={3} value={finalPa} onChange={(e) => setFinalPa(e.target.value)} placeholder="—" />
              </div>
            </div>
            <button type="button" className="ai-guide-primary" disabled={!onApplyToForm} onClick={saveToForm}>
              Save Resolution Draft
            </button>
            <button type="button" className="ai-guide-secondary" onClick={() => setStep(2)}>
              Edit Why-Why Analysis
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
