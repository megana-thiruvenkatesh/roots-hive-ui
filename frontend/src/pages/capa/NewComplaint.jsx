import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { defectOptions } from '../../lib/aiEngineStub';
import { useAppAlerts } from '../../context/AppAlertsContext.jsx';
import HistoricResultCard from '../../components/HistoricResultCard.jsx';
import HistoricRecordsFindBar, { useHistoricRecordsFilter } from '../../components/HistoricRecordsFindBar.jsx';
import AiGuidedSolution from '../../components/AiGuidedSolution.jsx';
import FieldSourcePicker from '../../components/FieldSourcePicker.jsx';
import { COMPLAINT_TYPES, COMPLAINT_SEVERITIES } from '../../lib/complaintFormOptions.js';
import { useComplaintMasters } from '../../lib/useComplaintMasters.js';
import { logAudit } from '../../lib/auditLog.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function useDebounced(value, ms = 500) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function whyWhyToArray(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const FLOW_STEPS = [
  { n: 1, label: 'Complaint Details' },
  { n: 2, label: 'Why-Why & RCA' },
  { n: 3, label: 'CA / PA' },
  { n: 4, label: 'Approval sent' },
];

const PANE_KEYS = ['details', 'historic', 'ai'];

function PaneChevron({ collapsed, side = 'end' }) {
  /* Simple caret chevron — left when open (collapse), right when collapsed (expand) */
  const pointsRight = collapsed || side === 'start';
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d={pointsRight ? 'M6 3.2 11 8 6 12.8' : 'M10 3.2 5 8 10 12.8'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildPaneGrid(collapsed, focus) {
  // Default: sides a bit wider than strict 25/50/25
  const weights = { details: 1.15, historic: 1.8, ai: 1.15 };
  if (focus === 'details') Object.assign(weights, { details: 1.4, historic: 1.7, ai: 1 });
  if (focus === 'historic') Object.assign(weights, { details: 1, historic: 2.1, ai: 1 });
  if (focus === 'ai') Object.assign(weights, { details: 1, historic: 1.7, ai: 1.4 });
  return PANE_KEYS.map((key) =>
    collapsed[key] ? '44px' : `minmax(160px, ${weights[key]}fr)`
  ).join(' ');
}

function NcFlowTrack({ step, onSelect }) {
  return (
    <ol className="nc-flow-track" aria-label="Complaint flow">
      {FLOW_STEPS.map((item, index) => {
        const state = step > item.n ? 'done' : step === item.n ? 'current' : 'pending';
        const clickable = Boolean(onSelect) && item.n < 4 && item.n <= Math.min(step, 3);
        return (
          <li key={item.n} className={`nc-flow-step ${state}`}>
            {index > 0 ? <span className="nc-flow-line" aria-hidden="true" /> : null}
            <button
              type="button"
              className="nc-flow-node"
              disabled={!clickable}
              onClick={() => clickable && onSelect(item.n)}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="nc-flow-num">{item.n}</span>
              <span className="nc-flow-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function clampResultsToShow(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(20, Math.floor(n));
}

function validateDetails(form) {
  if (!form.type) return 'Complaint Type is required';
  if (!form.partCode.trim()) return 'Item Code is required';
  if (!form.part.trim()) return 'Item Name is required';
  if (!form.desc.trim()) return 'Problem Description is required';
  if (!form.defectCat) return 'Defect Category is required';
  if (form.type === 'Supplier' && !form.customer.trim()) return 'Customer / Supplier Code is required';
  if (form.lotQty === '' || form.lotQty == null) return 'Lot Quantity is required';
  if (form.defectQty === '' || form.defectQty == null) return 'Defect Quantity is required';
  if (!form.severity) return 'Issue Severity is required';
  if (!form.complaintDate) return 'Date of Issue is required';
  return '';
}

function validateRca(form) {
  if (!form.rootCause.trim()) return 'RCA is required';
  if (!form.whyWhyText.trim()) return 'Why-Why is required';
  return '';
}

function validateCapa(form) {
  if (!form.correctiveAction.trim()) return 'Corrective Action (CA) is required';
  if (!form.preventiveAction.trim()) return 'Preventive Action (PA) is required';
  return '';
}

export default function NewComplaint() {
  const { pushToast, refreshUnread } = useAppAlerts();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { masters } = useComplaintMasters();
  const typeOptions = masters.types?.length ? masters.types : COMPLAINT_TYPES;
  const severityOptions = masters.severities?.length ? masters.severities : COMPLAINT_SEVERITIES;
  const defectOptionsList = masters.defects?.length ? masters.defects : defectOptions();

  const [step, setStep] = useState(1);
  const [flowDir, setFlowDir] = useState('forward');
  const [draftId, setDraftId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null); // { tone, text }
  const [fieldSources, setFieldSources] = useState({});
  const [linkedHistoric, setLinkedHistoric] = useState({});
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [resendMode, setResendMode] = useState(false);
  const [approvalSent, setApprovalSent] = useState(false);
  const editLoadedRef = useRef(null);

  const initialForm = {
    complaintDate: '',
    type: '',
    severity: '',
    defectCat: '',
    customer: '',
    part: '',
    partCode: '',
    desc: '',
    lotQty: '',
    defectQty: '',
    resultsToShow: 3,
    rootCause: '',
    whyWhyText: '',
    correctiveAction: '',
    preventiveAction: '',
  };

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [matching, setMatching] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [selectedGrounding, setSelectedGrounding] = useState(null);
  const [hoveredPane, setHoveredPane] = useState(null);
  const [collapsedPanes, setCollapsedPanes] = useState({
    details: false,
    historic: false,
    ai: false,
  });
  const historicFilter = useHistoricRecordsFilter(matches);
  const resultsToShow = clampResultsToShow(form.resultsToShow);
  const shownHistoric = historicFilter.shownMatches.slice(0, resultsToShow);

  function togglePane(key) {
    setCollapsedPanes((prev) => {
      const nextCollapsed = !prev[key];
      const openCount = PANE_KEYS.filter((k) => !prev[k]).length;
      if (nextCollapsed && openCount <= 1) return prev;
      const next = { ...prev, [key]: nextCollapsed };
      if (nextCollapsed && hoveredPane === key) setHoveredPane(null);
      return next;
    });
  }

  function onPaneEnter(key) {
    if (collapsedPanes[key]) return;
    setHoveredPane(key);
  }

  function onPaneLeave(key) {
    setHoveredPane((h) => (h === key ? null : h));
  }

  const debouncedDesc = useDebounced(form.desc, 450);
  const debouncedCat = useDebounced(form.defectCat, 450);
  const debouncedPart = useDebounced(form.part, 450);
  const debouncedType = useDebounced(form.type, 200);

  function upd(k, v) {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === 'type' && v === 'Internal') next.customer = '';
      return next;
    });
    if (k === 'type') {
      logAudit({
        module: 'New Complaint',
        action: 'Type changed',
        detail: `Complaint type set to ${v}`,
        meta: { type: v },
      });
    }
  }

  useEffect(() => {
    logAudit({
      module: 'New Complaint',
      action: 'Page opened',
      detail: 'New complaint form loaded',
    });
  }, []);

  // Re-open a Rejected / Draft complaint for update & resend
  useEffect(() => {
    const editId = String(searchParams.get('edit') || '').trim();
    if (!editId || editLoadedRef.current === editId) return;
    editLoadedRef.current = editId;
    setError('');
    api
      .get(`/complaints/${editId}`)
      .then((data) => {
        const c = data.complaint;
        if (!c) throw new Error('Complaint not found');
        if (!['Draft', 'Rejected'].includes(c.stage)) {
          throw new Error(`Cannot edit complaint in stage "${c.stage}"`);
        }
        const wizard = c.wizardData || {};
        setDraftId(c.id);
        setResendMode(true);
        setRejectionFeedback(wizard.rejectionFeedback || '');
        setForm({
          complaintDate: c.raisedDate || todayIso(),
          type: c.type || 'Internal',
          severity: c.severity || 'Major',
          defectCat: c.defectCat || 'Leakage',
          customer: c.customer || '',
          part: c.part || '',
          partCode: c.partCode || '',
          desc: c.desc || '',
          lotQty: c.lotQty ?? '',
          defectQty: c.defectQty ?? '',
          resultsToShow: clampResultsToShow(wizard.resultsToShow ?? 3),
          rootCause: c.rootCause || '',
          whyWhyText: Array.isArray(c.whyWhy) ? c.whyWhy.join('\n') : '',
          correctiveAction: c.correctiveAction || '',
          preventiveAction: c.preventiveAction || '',
        });
        setFieldSources(wizard.fieldSources || {});
        const hist = {};
        if (Array.isArray(wizard.historicRecords)) {
          wizard.historicRecords.forEach((h) => {
            if (h?.field && h?.record) hist[h.field] = h.record;
            else if (h?.id) hist[h.id] = h;
          });
        }
        setLinkedHistoric(hist);
        // Jump to CA/PA so sender can update and Send Approval
        setFlowDir('forward');
        setStep(3);
        pushToast(`Loaded ${c.id} — update then Send Approval to notify admin`, 'info');
      })
      .catch((err) => {
        setError(err.message || 'Failed to load complaint');
        pushToast(err.message || 'Failed to load complaint', 'error');
      });
  }, [searchParams, pushToast]);

  useEffect(() => {
    const q = debouncedDesc.trim();
    if (q.length < 8 && !debouncedCat) {
      setMatches([]);
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    setMatching(true);
    api
      .post('/complaints/similar', {
        type: debouncedType || 'Internal',
        description: debouncedDesc,
        defectCat: debouncedCat,
        part: debouncedPart,
      })
      .then((data) => {
        if (cancelled) return;
        setMatches(data.matches || []);
        setSuggestion(data.suggestion || null);
        setExpanded({});
        setSelectedGrounding((current) => {
          if (!current?.id) return null;
          return (data.matches || []).some((match) => match.id === current.id) ? current : null;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
          setSuggestion(null);
        }
      })
      .finally(() => {
        if (!cancelled) setMatching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedDesc, debouncedCat, debouncedPart, debouncedType]);

  async function generateGuidedAssist() {
    if (!selectedGrounding?.id) {
      throw new Error('Select one historic case as reference before generating.');
    }
    setAiBusy(true);
    try {
      const data = await api.post('/ai/complaint-assist', {
        type: form.type || 'Internal',
        description: form.desc,
        defectCat: form.defectCat,
        part: form.part,
        groundingId: selectedGrounding.id,
        grounding: {
          id: selectedGrounding.id,
          rootCause: selectedGrounding.rootCause,
          whyWhy: selectedGrounding.whyWhy,
          correctiveAction: selectedGrounding.correctiveAction,
          preventiveAction: selectedGrounding.preventiveAction,
          symptom: selectedGrounding.desc || selectedGrounding.symptom,
        },
      });
      if (data.suggestion) setSuggestion(data.suggestion);
      return data;
    } finally {
      setAiBusy(false);
    }
  }

  function applyGuidedToForm(fields) {
    setForm((prev) => ({
      ...prev,
      rootCause: fields.rootCause ?? prev.rootCause,
      whyWhyText: fields.whyWhyText ?? prev.whyWhyText,
      correctiveAction: fields.correctiveAction ?? prev.correctiveAction,
      preventiveAction: fields.preventiveAction ?? prev.preventiveAction,
    }));
    setToastMsg({ tone: 'success', text: 'Resolution draft saved into RCA / Why-Why / CA / PA fields.' });
    pushToast('AI resolution draft applied to the form', 'success');
  }

  function buildPayload(extra = {}) {
    const lot = form.lotQty === '' ? null : Number(form.lotQty);
    const defQ = form.defectQty === '' ? null : Number(form.defectQty);
    let rejection = null;
    if (lot && defQ != null && lot > 0) {
      rejection = Number(((defQ / lot) * 100).toFixed(2));
    }
    return {
      id: draftId || undefined,
      type: form.type,
      severity: form.severity,
      defectCat: form.defectCat,
      customer: form.type === 'Supplier' ? form.customer : null,
      part: form.part,
      partCode: form.partCode,
      desc: form.desc,
      raisedDate: form.complaintDate,
      lotQty: lot,
      defectQty: defQ,
      rejectionPct: rejection,
      rootCause: form.rootCause || null,
      correctiveAction: form.correctiveAction || null,
      preventiveAction: form.preventiveAction || null,
      whyWhy: whyWhyToArray(form.whyWhyText),
      wizardData: {
        step,
        resultsToShow: clampResultsToShow(form.resultsToShow),
        fieldSources,
        historicRecords: Object.values(linkedHistoric),
      },
      ...extra,
    };
  }

  function setFieldValue(key, value, meta = {}) {
    const formKey = key === 'whyWhy' ? 'whyWhyText' : key;
    upd(formKey, value);
    setFieldSources((prev) => ({
      ...prev,
      [key]: {
        source: meta.source || 'manual',
        historicId: meta.historic?.id || null,
        historicLabel: meta.historic
          ? `${meta.historic.id}${meta.historic.symptom ? ` · ${meta.historic.symptom}` : ''}`
          : null,
      },
    }));
    if (meta.source === 'historic' && meta.historic?.id) {
      setLinkedHistoric((prev) => ({
        ...prev,
        [meta.historic.id]: meta.historic,
      }));
    }
  }

  async function saveDraft(label) {
    setSaving(true);
    setError('');
    try {
      const data = await api.post('/complaints/draft', buildPayload({ saveLabel: label }));
      setDraftId(data.complaint.id);
      return data.complaint;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  function goToStep(next, direction = 'forward') {
    if (next === step || next < 1 || next > 4) return;
    setFlowDir(direction);
    setStep(next);
  }

  function goNextFromDetails(e) {
    e.preventDefault();
    const msg = validateDetails(form);
    if (msg) {
      setError(msg);
      pushToast(msg, 'error');
      return;
    }
    setError('');
    saveDraft('Next (Details)')
      .then(() => goToStep(2, 'forward'))
      .catch(() => {});
  }

  async function goNextFromRca(e) {
    e.preventDefault();
    const msg = validateRca(form);
    if (msg) {
      setError(msg);
      pushToast(msg, 'error');
      return;
    }
    try {
      await saveDraft('Next (RCA / Why-Why)');
      goToStep(3, 'forward');
    } catch {
      /* error set */
    }
  }

  async function sendApproval(e) {
    e.preventDefault();
    const detailsMsg = validateDetails(form);
    if (detailsMsg) {
      setError(detailsMsg);
      pushToast(detailsMsg, 'error');
      goToStep(1, 'back');
      return;
    }
    const rcaMsg = validateRca(form);
    if (rcaMsg) {
      setError(rcaMsg);
      pushToast(rcaMsg, 'error');
      goToStep(2, 'back');
      return;
    }
    const capaMsg = validateCapa(form);
    if (capaMsg) {
      setError(capaMsg);
      pushToast(capaMsg, 'error');
      return;
    }
    setSaving(true);
    setError('');
    setToastMsg(null);
    try {
      const draft = await api.post('/complaints/draft', buildPayload({ saveLabel: resendMode ? 'Updated before re-send' : 'Draft before approval' }));
      setDraftId(draft.complaint.id);
      await api.post(`/complaints/${draft.complaint.id}/send-approval`);
      setToastMsg({
        tone: 'success',
        text: resendMode
          ? 'Updated & re-sent to Admin for approval'
          : 'Approval sent to Admin — after approval, Submit to register',
      });
      pushToast(resendMode ? 'Re-sent to Admin' : 'Approval sent to Admin', 'success');
      await refreshUnread();
      setApprovalSent(true);
      goToStep(4, 'forward');
      window.setTimeout(() => setToastMsg(null), 4500);
    } catch (err) {
      const message = err.message || 'Failed to send approval';
      setError(message);
      setToastMsg({ tone: 'error', text: message });
      pushToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const stepTitle =
    step === 1
      ? 'Complaint Details'
      : step === 2
        ? 'Why-Why & RCA'
        : step === 4
          ? 'Approval sent'
          : resendMode
            ? 'Update CA / PA & re-send to Admin'
            : 'CA / PA';

  function onDetailsSubmit(e) {
    if (step === 1) return goNextFromDetails(e);
    if (step === 2) return goNextFromRca(e);
    if (step === 3) return sendApproval(e);
    e.preventDefault();
  }

  const trackStep = approvalSent || step === 4 ? 4 : Math.min(step, 3);

  return (
    <div className="new-complaint-page">
      <div className="page-head nc-page-head-row">
        <h1>{resendMode ? `Update & resend · ${draftId || ''}` : 'New Complaint'}</h1>
        <NcFlowTrack
          step={trackStep}
          onSelect={step < 4 && !approvalSent ? (n) => goToStep(n, n < step ? 'back' : 'forward') : undefined}
        />
      </div>

      {toastMsg ? (
        <div className={`nc-inline-toast ${toastMsg.tone}`}>
          {toastMsg.text}
        </div>
      ) : null}

      {resendMode && rejectionFeedback ? (
        <div className="notif-feedback" style={{ marginBottom: 12 }}>
          <span className="kb-meta-label">Rejection feedback — update then Send Approval</span>
          <strong>{rejectionFeedback}</strong>
        </div>
      ) : null}

      <div
        className={`new-complaint-row${hoveredPane ? ` nc-focus-${hoveredPane}` : ''}`}
        style={{ gridTemplateColumns: buildPaneGrid(collapsedPanes, hoveredPane) }}
      >
        <section
          className={`result-card-section${hoveredPane === 'details' ? ' is-hovered' : ''}${collapsedPanes.details ? ' is-collapsed' : ''}`}
          onMouseEnter={() => onPaneEnter('details')}
          onMouseLeave={() => onPaneLeave('details')}
        >
          {collapsedPanes.details ? (
            <button
              type="button"
              className="nc-pane-rail"
              title="Expand Complaint Details"
              onClick={(e) => {
                e.stopPropagation();
                togglePane('details');
              }}
            >
              <span className="nc-pane-rail-label">{stepTitle}</span>
              <span className="nc-pane-rail-arrow"><PaneChevron collapsed /></span>
            </button>
          ) : (
            <>
              <div className="outside-card-title">
                <span className="outside-card-title-text">{stepTitle}</span>
              </div>
              <form className="card nc-card nc-details-card nc-pane-card" onSubmit={onDetailsSubmit}>
                <button
                  type="button"
                  className="nc-pane-toggle nc-pane-toggle-in"
                  title="Collapse panel"
                  aria-label="Collapse Complaint Details"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePane('details');
                  }}
                >
                  <PaneChevron collapsed={false} />
                </button>
            <div className="nc-wizard-stage">
              <div
                key={step}
                className={`nc-wizard-scroll nc-flow-panel nc-flow-${flowDir}`}
              >
                {step === 1 ? (
                  <>
                    <div className="form-grid-3 nc-form-fields">
                      <div className="field">
                        <label>Complaint Type</label>
                        <select className="input" value={form.type} onChange={(e) => upd('type', e.target.value)}>
                          <option value="">(none selected)</option>
                          {typeOptions.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>Issue Severity</label>
                        <select className="input" value={form.severity} onChange={(e) => upd('severity', e.target.value)}>
                          <option value="">(not specified)</option>
                          {severityOptions.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="field nc-date-field">
                        <label>Date of Issue</label>
                        <input className="input nc-date-input" type="date" value={form.complaintDate} onChange={(e) => upd('complaintDate', e.target.value)} required />
                      </div>
                    </div>

                    <div className="form-grid-2 nc-form-fields">
                      <div className="field">
                        <label>Item Code</label>
                        <input className="input" value={form.partCode} onChange={(e) => upd('partCode', e.target.value)} placeholder="type to search..." required />
                      </div>
                      <div className="field">
                        <label>Item Name</label>
                        <input className="input" value={form.part} onChange={(e) => upd('part', e.target.value)} placeholder="type to search..." required />
                      </div>
                    </div>

                    <div className="field">
                      <label>Problem Description *</label>
                      <textarea className="input" rows={3} value={form.desc} onChange={(e) => upd('desc', e.target.value)} placeholder="Describe the defect..." required />
                    </div>

                    {form.type === 'Supplier' ? (
                      <div className="form-grid-2 nc-form-fields">
                        <div className="field">
                          <label>Defect Category</label>
                          <select className="input" value={form.defectCat} onChange={(e) => upd('defectCat', e.target.value)}>
                            <option value="">(none selected)</option>
                            {defectOptionsList.map((d) => <option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Customer / Supplier Code</label>
                          <input className="input" value={form.customer} onChange={(e) => upd('customer', e.target.value)} placeholder="type to search..." />
                        </div>
                      </div>
                    ) : (
                      <div className="field">
                        <label>Defect Category</label>
                        <select className="input" value={form.defectCat} onChange={(e) => upd('defectCat', e.target.value)}>
                          <option value="">(none selected)</option>
                          {defectOptionsList.map((d) => <option key={d}>{d}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="form-grid-3 nc-form-fields">
                      <div className="field">
                        <label>Lot Quantity</label>
                        <input className="input" type="number" min="0" value={form.lotQty} onChange={(e) => upd('lotQty', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Defect Quantity</label>
                        <input className="input" type="number" min="0" value={form.defectQty} onChange={(e) => upd('defectQty', e.target.value)} />
                      </div>
                      <div className="field nc-results-field">
                        <label>Results to show</label>
                        <input
                          className="input"
                          type="number"
                          min="1"
                          max="20"
                          value={form.resultsToShow}
                          title={`Will display ${clampResultsToShow(form.resultsToShow)} of ${matches.length || 0} matched record${matches.length === 1 ? '' : 's'}`}
                          onChange={(e) => upd('resultsToShow', e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <FieldSourcePicker
                      label="Why-Why"
                      value={form.whyWhyText}
                      onChange={(v, meta) => setFieldValue('whyWhy', v, meta)}
                      multiline
                      historicMatches={matches}
                      aiSuggestion={suggestion}
                      fieldKey="whyWhy"
                    />
                    <FieldSourcePicker
                      label="RCA"
                      value={form.rootCause}
                      onChange={(v, meta) => setFieldValue('rootCause', v, meta)}
                      multiline
                      historicMatches={matches}
                      aiSuggestion={suggestion}
                      fieldKey="rootCause"
                    />
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <FieldSourcePicker
                      label="Corrective Action (CA)"
                      value={form.correctiveAction}
                      onChange={(v, meta) => setFieldValue('correctiveAction', v, meta)}
                      multiline
                      historicMatches={matches}
                      aiSuggestion={suggestion}
                      fieldKey="correctiveAction"
                    />
                    <FieldSourcePicker
                      label="Preventive Action (PA)"
                      value={form.preventiveAction}
                      onChange={(v, meta) => setFieldValue('preventiveAction', v, meta)}
                      multiline
                      historicMatches={matches}
                      aiSuggestion={suggestion}
                      fieldKey="preventiveAction"
                    />
                    {draftId ? <p className="muted" style={{ margin: 0 }}>Draft ID: {draftId}</p> : null}
                  </>
                ) : null}

                {step === 4 ? (
                  <div className="nc-sent-panel">
                    <p className="nc-sent-kicker">Flow complete</p>
                    <h3 className="nc-sent-title">Approval sent</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {draftId ? `${draftId} is with Admin for approval.` : 'This complaint is with Admin for approval.'}
                      {' '}After approval, Submit to register.
                    </p>
                  </div>
                ) : null}

                {error ? <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p> : null}
                {matching && step === 1 ? <span className="muted">Matching historic records…</span> : null}
              </div>
            </div>

            <div className="nc-wizard-footer">
              {step < 4 ? (
                <button
                  type="button"
                  className="btn secondary nc-nav-btn"
                  disabled={saving}
                  onClick={() => {
                    if (step === 1) navigate('/complaints');
                    else goToStep(step - 1, 'back');
                  }}
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              <div className="nc-wizard-right">
                {step === 4 ? (
                  <button
                    type="button"
                    className="btn nc-nav-btn"
                    onClick={() => {
                      setApprovalSent(false);
                      setStep(1);
                      setFlowDir('forward');
                      setDraftId(null);
                      setResendMode(false);
                      setRejectionFeedback('');
                      editLoadedRef.current = null;
                      setForm(initialForm);
                      setFieldSources({});
                      setLinkedHistoric({});
                      setMatches([]);
                      setSuggestion(null);
                      setExpanded({});
                      setSelectedGrounding(null);
                      setError('');
                    }}
                  >
                    New complaint
                  </button>
                ) : (
                  <button type="submit" className="btn nc-nav-btn" disabled={saving}>
                    {saving
                      ? step === 3
                        ? 'Sending…'
                        : 'Saving…'
                      : step === 3
                        ? resendMode
                          ? 'Update & Send Approval'
                          : 'Send Approval'
                        : 'Next'}
                  </button>
                )}
              </div>
            </div>
          </form>
            </>
          )}
        </section>

        <section
          className={`result-card-section${hoveredPane === 'historic' ? ' is-hovered' : ''}${collapsedPanes.historic ? ' is-collapsed' : ''}`}
          onMouseEnter={() => onPaneEnter('historic')}
          onMouseLeave={() => onPaneLeave('historic')}
        >
          {collapsedPanes.historic ? (
            <button
              type="button"
              className="nc-pane-rail"
              title="Expand Historic Records"
              onClick={(e) => {
                e.stopPropagation();
                togglePane('historic');
              }}
            >
              <span className="nc-pane-rail-label">Historic Records</span>
              <span className="nc-pane-rail-arrow"><PaneChevron collapsed /></span>
            </button>
          ) : (
            <>
          <div className="outside-card-title">
            <span className="outside-card-title-text">
              Historic Records
              <span className="muted" style={{ fontWeight: 600, marginLeft: 8 }}>
                ({form.type || 'source'} · {shownHistoric.length} shown / {matches.length} total)
              </span>
            </span>
          </div>
          <div className="card nc-card nc-pane-card">
            <button
              type="button"
              className="nc-pane-toggle nc-pane-toggle-in"
              title="Collapse panel"
              aria-label="Collapse Historic Records"
              onClick={(e) => {
                e.stopPropagation();
                togglePane('historic');
              }}
            >
              <PaneChevron collapsed={false} />
            </button>
            {!matches.length ? (
              <p className="muted" style={{ margin: 0 }}>
                {form.desc.trim().length < 8
                  ? 'Type a problem description to auto-fetch similar historic cases.'
                  : matching
                    ? 'Searching…'
                    : `No close matches in the ${form.type} data source yet.`}
              </p>
            ) : (
              <>
                <HistoricRecordsFindBar filter={{ ...historicFilter, shownMatches: shownHistoric }} totalCount={matches.length} />
                {!shownHistoric.length ? (
                  <div className="empty-panel" style={{ padding: 18 }}>
                    <h3 style={{ marginTop: 0 }}>No matches with filters</h3>
                    <p className="muted" style={{ margin: 0 }}>Try reducing the similarity threshold or clearing the find bar.</p>
                  </div>
                ) : (
                  <div className="hist-stack">
                    {shownHistoric.map((m, index) => (
                      <HistoricResultCard
                        key={`${m.source}-${m.id}`}
                        item={m}
                        rank={index + 1}
                        expanded={Boolean(expanded[m.id])}
                        onToggle={() => setExpanded((current) => ({ ...current, [m.id]: !current[m.id] }))}
                        selected={selectedGrounding?.id === m.id}
                        onSelectReference={(item) => setSelectedGrounding(item)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
            </>
          )}
        </section>

        <section
          className={`result-card-section${hoveredPane === 'ai' ? ' is-hovered' : ''}${collapsedPanes.ai ? ' is-collapsed' : ''}`}
          onMouseEnter={() => onPaneEnter('ai')}
          onMouseLeave={() => onPaneLeave('ai')}
        >
          {collapsedPanes.ai ? (
            <button
              type="button"
              className="nc-pane-rail"
              title="Expand AI Suggested Solution"
              onClick={(e) => {
                e.stopPropagation();
                togglePane('ai');
              }}
            >
              <span className="nc-pane-rail-label">AI Suggested Solution</span>
              <span className="nc-pane-rail-arrow"><PaneChevron collapsed /></span>
            </button>
          ) : (
            <>
          <div className="outside-card-title">
            <span className="outside-card-title-text">AI Suggested Solution</span>
          </div>
          <div className="card nc-card nc-ai-card nc-pane-card">
            <button
              type="button"
              className="nc-pane-toggle nc-pane-toggle-in"
              title="Collapse panel"
              aria-label="Collapse AI Suggested Solution"
              onClick={(e) => {
                e.stopPropagation();
                togglePane('ai');
              }}
            >
              <PaneChevron collapsed={false} />
            </button>
            <AiGuidedSolution
              form={form}
              grounding={selectedGrounding}
              suggestion={suggestion}
              busy={aiBusy}
              onGenerate={generateGuidedAssist}
              onApplyToForm={applyGuidedToForm}
            />
          </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
