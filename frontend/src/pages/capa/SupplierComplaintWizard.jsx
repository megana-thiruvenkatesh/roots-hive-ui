import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  QA_NETWORK_OPTIONS,
  PROBABLE_CAUSES,
  SUPPLIER_STEPS,
  complaintFieldsFromStep1,
  defaultWizardData,
  mergeWizardData,
} from './supplierWizardDefaults';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function FilePick({ label, fileName, onPick }) {
  return (
    <Field label={label}>
      <div className="file-pick-row">
        <input
          type="file"
          className="input"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
        {fileName ? <span className="file-name-link">{fileName}</span> : null}
      </div>
    </Field>
  );
}

function StepForm({ stepKey, data, onChange, onFile }) {
  const set = (k, v) => onChange({ ...data, [k]: v });

  if (stepKey === 'step1') {
    return (
      <div className="form-grid-3">
        <Field label="Notification No">
          <input className="input" value={data.notificationNo} onChange={(e) => set('notificationNo', e.target.value)} />
        </Field>
        <Field label="Supplier Code & Name">
          <input className="input" value={data.supplierCodeName} onChange={(e) => set('supplierCodeName', e.target.value)} />
        </Field>
        <Field label="Item code & Name">
          <input className="input" value={data.itemCodeName} onChange={(e) => set('itemCodeName', e.target.value)} />
        </Field>
        <Field label="DC No. & DC Date">
          <input className="input" value={data.dcNoDate} onChange={(e) => set('dcNoDate', e.target.value)} placeholder="e.g. 1136 & 08/11/2023" />
        </Field>
        <Field label="Date of Issue">
          <input className="input" type="date" value={data.dateOfIssue} onChange={(e) => set('dateOfIssue', e.target.value)} />
        </Field>
        <Field label="Lot Qty">
          <input className="input" type="number" min="0" step="any" value={data.lotQty} onChange={(e) => set('lotQty', e.target.value)} />
        </Field>
        <Field label="Problem Qty">
          <input className="input" type="number" min="0" step="any" value={data.problemQty} onChange={(e) => set('problemQty', e.target.value)} />
        </Field>
        <Field label="Inspected Qty">
          <input className="input" type="number" min="0" step="any" value={data.inspectedQty} onChange={(e) => set('inspectedQty', e.target.value)} />
        </Field>
        <Field label="Problem Raised by">
          <input className="input" value={data.problemRaisedBy} onChange={(e) => set('problemRaisedBy', e.target.value)} />
        </Field>
        <Field label="SPN Number">
          <input className="input" value={data.spnNumber} onChange={(e) => set('spnNumber', e.target.value)} />
        </Field>
        <Field label="Symptom">
          <input className="input" value={data.symptom} onChange={(e) => set('symptom', e.target.value)} />
        </Field>
        <FilePick
          label="Problem Photo"
          fileName={data.problemPhotoName}
          onPick={(f) => onFile('problemPhoto', f, (name) => set('problemPhotoName', name))}
        />
        <Field label="Problem">
          <input className="input" value={data.problem} onChange={(e) => set('problem', e.target.value)} />
        </Field>
        <Field label="SPN Type">
          <input className="input" value={data.spnType} onChange={(e) => set('spnType', e.target.value)} />
        </Field>
        <FilePick
          label="Ok part Reference"
          fileName={data.okPartRefName}
          onPick={(f) => onFile('okPartRef', f, (name) => set('okPartRefName', name))}
        />
        <Field label="Problem Statement">
          <textarea className="input" rows={2} value={data.problemStatement} onChange={(e) => set('problemStatement', e.target.value)} />
        </Field>
        <Field label="Problem Identified At">
          <input className="input" value={data.problemIdentifiedAt} onChange={(e) => set('problemIdentifiedAt', e.target.value)} />
        </Field>
      </div>
    );
  }

  if (stepKey === 'step2') {
    return (
      <div className="form-grid-2">
        <Field label="Defect part produced on">
          <input className="input" type="date" value={data.defectPartProducedOn} onChange={(e) => set('defectPartProducedOn', e.target.value)} />
        </Field>
        <Field label="Complaint received on">
          <input className="input" type="date" value={data.complaintReceivedOn} onChange={(e) => set('complaintReceivedOn', e.target.value)} />
        </Field>
        <Field label="Machine name">
          <input className="input" value={data.machineName} onChange={(e) => set('machineName', e.target.value)} />
        </Field>
        <Field label="Operator name">
          <input className="input" value={data.operatorName} onChange={(e) => set('operatorName', e.target.value)} />
        </Field>
      </div>
    );
  }

  if (stepKey === 'step3') {
    return (
      <div className="stack">
        <div className="form-grid-5">
          <Field label="Area / Location">
            <input className="input" value={data.areaLocation} onChange={(e) => set('areaLocation', e.target.value)} />
          </Field>
          <Field label="No. of Parts inspected">
            <input className="input" type="number" min="0" value={data.partsInspected} onChange={(e) => set('partsInspected', e.target.value)} />
          </Field>
          <Field label="Inspection method">
            <input className="input" value={data.inspectionMethod} onChange={(e) => set('inspectionMethod', e.target.value)} />
          </Field>
          <Field label="OK Qty">
            <input className="input" type="number" min="0" value={data.okQty} onChange={(e) => set('okQty', e.target.value)} />
          </Field>
          <Field label="Not OK Qty">
            <input className="input" type="number" min="0" value={data.notOkQty} onChange={(e) => set('notOkQty', e.target.value)} />
          </Field>
        </div>
        <Field label="Containment notes">
          <textarea className="input" rows={3} value={data.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <FilePick
          label="Containment attachment"
          fileName={data.containmentFileName}
          onPick={(f) => onFile('containment', f, (name) => set('containmentFileName', name))}
        />
      </div>
    );
  }

  if (stepKey === 'step4') {
    const rows = data.rows || [];
    const updRow = (idx, patch) => {
      const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      onChange({ ...data, rows: next });
    };
    return (
      <div className="stack">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Probable Cause</th>
                <th>Why 1</th>
                <th>Why 2</th>
                <th>Why 3</th>
                <th>Why 4</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <select
                      className="input"
                      value={r.probableCause}
                      onChange={(e) => updRow(idx, { probableCause: e.target.value })}
                    >
                      {PROBABLE_CAUSES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  {['why1', 'why2', 'why3', 'why4'].map((k) => (
                    <td key={k}>
                      <input className="input" value={r[k]} onChange={(e) => updRow(idx, { [k]: e.target.value })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            onChange({
              ...data,
              rows: [...rows, { probableCause: 'Occurrence', why1: '', why2: '', why3: '', why4: '' }],
            })
          }
        >
          + Add row
        </button>
      </div>
    );
  }

  if (stepKey === 'step4_1') {
    return (
      <div className="stack">
        <Field label="Simulation test">
          <textarea className="input" rows={3} value={data.simulationTest} onChange={(e) => set('simulationTest', e.target.value)} />
        </Field>
        <Field label="Mechanism of occurrence">
          <textarea
            className="input"
            rows={3}
            value={data.mechanismOfOccurrence}
            onChange={(e) => set('mechanismOfOccurrence', e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (stepKey === 'step5') {
    const actions = data.actions || [];
    const upd = (idx, patch) => {
      onChange({ ...data, actions: actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)) });
    };
    return (
      <div className="stack">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Identified Root Cause(s) From Last Why</th>
                <th>Occurrence / Outflow</th>
                <th>Corrective Action</th>
                <th>Responsible</th>
                <th>Target date</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <textarea className="input" rows={2} value={a.rootCause} onChange={(e) => upd(idx, { rootCause: e.target.value })} />
                  </td>
                  <td>
                    <select
                      className="input"
                      value={a.occurrenceOutflow}
                      onChange={(e) => upd(idx, { occurrenceOutflow: e.target.value })}
                    >
                      {PROBABLE_CAUSES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <textarea
                      className="input"
                      rows={2}
                      value={a.correctiveAction}
                      onChange={(e) => upd(idx, { correctiveAction: e.target.value })}
                    />
                  </td>
                  <td>
                    <input className="input" value={a.responsible} onChange={(e) => upd(idx, { responsible: e.target.value })} />
                  </td>
                  <td>
                    <input className="input" type="date" value={a.targetDate} onChange={(e) => upd(idx, { targetDate: e.target.value })} />
                  </td>
                  <td>
                    <input
                      type="file"
                      className="input"
                      onChange={(e) =>
                        onFile(`ca_${idx}`, e.target.files?.[0] || null, (name) => upd(idx, { fileName: name }))
                      }
                    />
                    {a.fileName ? <div className="file-name-link">{a.fileName}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            onChange({
              ...data,
              actions: [
                ...actions,
                {
                  rootCause: '',
                  occurrenceOutflow: 'Occurrence',
                  correctiveAction: '',
                  responsible: '',
                  targetDate: '',
                  fileName: '',
                },
              ],
            })
          }
        >
          + Add action
        </button>
        <div className="form-grid-2" style={{ marginTop: 12 }}>
          <Field label="Remarks (Status Updation)">
            <textarea className="input" rows={3} value={data.remarks} onChange={(e) => set('remarks', e.target.value)} />
          </Field>
          <Field label="Status">
            <select className="input" value={data.status} onChange={(e) => set('status', e.target.value)}>
              {['Open', 'In Progress', 'Re-Open', 'Completed'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    );
  }

  if (stepKey === 'step6') {
    const selected = new Set(data.qaNetwork || []);
    const toggle = (opt) => {
      const next = new Set(selected);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      set('qaNetwork', [...next]);
    };
    return (
      <div className="stack">
        <Field label="QA Network">
          <div className="chip-toggle-row">
            {QA_NETWORK_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`chip-toggle ${selected.has(opt) ? 'on' : ''}`}
                onClick={() => toggle(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </Field>
        <FilePick
          label="Download / attach document"
          fileName={data.attachmentName}
          onPick={(f) => onFile('standardization', f, (name) => set('attachmentName', name))}
        />
        <Field label="Verification of CA and Evidence">
          <textarea
            className="input"
            rows={3}
            value={data.verificationEvidence}
            onChange={(e) => set('verificationEvidence', e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (stepKey === 'step7_1') {
    return (
      <div className="stack">
        <Field label="Horizontal Deployment">
          <div className="yes-no-row">
            {['Yes', 'No'].map((v) => (
              <button
                key={v}
                type="button"
                className={`chip-toggle ${data.horizontalDeployment === v ? 'on' : ''}`}
                onClick={() => set('horizontalDeployment', v)}
              >
                {v}
              </button>
            ))}
          </div>
        </Field>
        <Field label="If Yes, Applicable item">
          <input className="input" value={data.applicableItem} onChange={(e) => set('applicableItem', e.target.value)} />
        </Field>
        <Field label="Responsibility">
          <input className="input" value={data.responsibility} onChange={(e) => set('responsibility', e.target.value)} />
        </Field>
        <Field label="Target date">
          <input className="input" type="date" value={data.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        </Field>
        <Field label="Implemented">
          <input className="input" value={data.implemented} onChange={(e) => set('implemented', e.target.value)} />
        </Field>
      </div>
    );
  }

  if (stepKey === 'step7_2') {
    const months = data.months || [];
    const upd = (idx, patch) => {
      onChange({ ...data, months: months.map((m, i) => (i === idx ? { ...m, ...patch } : m)) });
    };
    const yearNow = new Date().getFullYear();
    const years = [yearNow - 1, yearNow, yearNow + 1].map(String);
    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Year - Month</th>
              <th>Inspected Qty</th>
              <th>Rejection Qty</th>
              <th>Rework Qty</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m, idx) => (
              <tr key={idx}>
                <td>Month-{idx + 1}</td>
                <td>
                  <div className="inline-2">
                    <select className="input" value={m.year} onChange={(e) => upd(idx, { year: e.target.value })}>
                      <option value="">Year</option>
                      {years.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                    <select className="input" value={m.month} onChange={(e) => upd(idx, { month: e.target.value })}>
                      <option value="">Month</option>
                      {MONTHS.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  <input className="input" type="number" min="0" step="any" value={m.inspectedQty} onChange={(e) => upd(idx, { inspectedQty: e.target.value })} />
                </td>
                <td>
                  <input className="input" type="number" min="0" step="any" value={m.rejectionQty} onChange={(e) => upd(idx, { rejectionQty: e.target.value })} />
                </td>
                <td>
                  <input className="input" type="number" min="0" step="any" value={m.reworkQty} onChange={(e) => upd(idx, { reworkQty: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (stepKey === 'step8') {
    return (
      <Field label="Status">
        <select className="input" value={data.status} onChange={(e) => set('status', e.target.value)} style={{ maxWidth: 280 }}>
          {['Open', 'In Progress', 'Completed', 'Closed'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
    );
  }

  return null;
}

function summaryLine(stepKey, data) {
  if (!data) return 'No data yet';
  if (stepKey === 'step1') {
    return [data.notificationNo, data.supplierCodeName, data.symptom].filter(Boolean).join(' · ') || 'Issue details saved';
  }
  if (stepKey === 'step2') {
    return [data.machineName, data.operatorName].filter(Boolean).join(' · ') || 'Problem description saved';
  }
  if (stepKey === 'step3') {
    return [data.areaLocation, data.inspectionMethod].filter(Boolean).join(' · ') || 'Containment saved';
  }
  if (stepKey === 'step4') return `${(data.rows || []).length} why-why row(s)`;
  if (stepKey === 'step4_1') return data.simulationTest || data.mechanismOfOccurrence || 'Optional — saved';
  if (stepKey === 'step5') return `${(data.actions || []).length} corrective action(s) · ${data.status || ''}`;
  if (stepKey === 'step6') return (data.qaNetwork || []).join(', ') || 'Standardization saved';
  if (stepKey === 'step7_1') return `Horizontal: ${data.horizontalDeployment || '—'} · ${data.responsibility || ''}`;
  if (stepKey === 'step7_2') return 'Effectiveness monitoring saved';
  if (stepKey === 'step8') return `Status: ${data.status || '—'}`;
  return 'Saved';
}

export default function SupplierComplaintWizard() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [complaintId, setComplaintId] = useState(routeId || null);
  const [wizard, setWizard] = useState(defaultWizardData);
  const [expanded, setExpanded] = useState({});
  const [pendingFiles, setPendingFiles] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(routeId));

  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get(`/complaints/${routeId}`);
        if (cancelled) return;
        setComplaintId(data.complaint.id);
        setWizard(mergeWizardData(data.complaint.wizardData));
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const activeIndex = wizard.currentStep;
  const activeMeta = SUPPLIER_STEPS[activeIndex];

  const completedIndexes = useMemo(() => {
    const list = [];
    for (let i = 0; i < activeIndex; i++) list.push(i);
    return list;
  }, [activeIndex]);

  function updateStepData(stepKey, nextData) {
    setWizard((w) => ({
      ...w,
      steps: { ...w.steps, [stepKey]: nextData },
    }));
  }

  function handleFile(slot, file, setName) {
    if (!file) return;
    setPendingFiles((p) => ({ ...p, [slot]: file }));
    setName(file.name);
  }

  async function uploadPending(id) {
    const entries = Object.entries(pendingFiles).filter(([, f]) => f);
    if (!entries.length) return;
    const fd = new FormData();
    for (const [, file] of entries) fd.append('files', file);
    await api.upload(`/uploads/complaint/${id}`, fd);
    setPendingFiles({});
  }

  async function persist(nextWizard, { advance } = { advance: true }) {
    setSaving(true);
    setError('');
    try {
      const stepKey = SUPPLIER_STEPS[wizard.currentStep].key;
      const s1 = nextWizard.steps.step1;
      const mapped = complaintFieldsFromStep1(s1);
      const historyEntry = {
        date: new Date().toLocaleString(),
        action: advance
          ? `Saved ${SUPPLIER_STEPS[wizard.currentStep].title}`
          : `Updated ${SUPPLIER_STEPS[wizard.currentStep].title}`,
        by: user?.name || user?.email,
      };

      let id = complaintId;
      if (!id) {
        const created = await api.post('/complaints', {
          ...mapped,
          stage: 'Open',
          wizardData: nextWizard,
          history: [historyEntry],
        });
        id = created.complaint.id;
        setComplaintId(id);
        await uploadPending(id);
        navigate(`/complaints/${id}/wizard`, { replace: true });
      } else {
        const existing = await api.get(`/complaints/${id}`);
        const history = [...(existing.complaint.history || []), historyEntry];
        const patch = {
          ...mapped,
          wizardData: nextWizard,
          history,
        };
        if (stepKey === 'step4') {
          patch.whyWhy = (nextWizard.steps.step4.rows || []).map((r) => ({
            cause: r.probableCause,
            whys: [r.why1, r.why2, r.why3, r.why4].filter(Boolean),
          }));
        }
        if (stepKey === 'step5') {
          const first = nextWizard.steps.step5.actions?.[0];
          if (first?.rootCause) patch.rootCause = first.rootCause;
          if (first?.correctiveAction) patch.correctiveAction = first.correctiveAction;
        }
        if (stepKey === 'step7_1' && nextWizard.steps.step7_1.applicableItem) {
          patch.preventiveAction = [
            nextWizard.steps.step7_1.applicableItem,
            nextWizard.steps.step7_1.responsibility,
          ]
            .filter(Boolean)
            .join(' — ');
        }
        if (stepKey === 'step8') {
          patch.stage = nextWizard.steps.step8.status || 'Completed';
        }
        await api.patch(`/complaints/${id}`, patch);
        await uploadPending(id);
      }
      setWizard(nextWizard);
      return id;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function onNext() {
    try {
      if (activeIndex >= SUPPLIER_STEPS.length - 1) {
        const nextWizard = {
          ...wizard,
          currentStep: activeIndex,
          maxReached: Math.max(wizard.maxReached, activeIndex),
        };
        const id = await persist(nextWizard, { advance: true });
        navigate(`/complaints/${id}`);
        return;
      }
      const nextIndex = activeIndex + 1;
      const nextWizard = {
        ...wizard,
        currentStep: nextIndex,
        maxReached: Math.max(wizard.maxReached, nextIndex),
      };
      await persist(nextWizard, { advance: true });
      setExpanded({});
    } catch {
      /* error shown in state */
    }
  }

  async function onSaveCard(stepIndex) {
    const nextWizard = { ...wizard, currentStep: activeIndex, maxReached: wizard.maxReached };
    await persist(nextWizard, { advance: false });
    setExpanded((e) => ({ ...e, [stepIndex]: false }));
  }

  if (loading) {
    return <div className="page-head"><p className="muted">Loading supplier complaint…</p></div>;
  }

  return (
    <div className="supplier-wizard">
      <div className="page-head">
        <div>
          <h1>Supplier Complaint</h1>
          <p>
            8D multi-step form{complaintId ? ` · ${complaintId}` : ''}. Each Next saves to the server.
            Completed steps collapse into editable cards.
          </p>
        </div>
        <Link to="/complaints" className="btn ghost">
          Back to list
        </Link>
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p> : null}

      <div className="wizard-stack">
        {completedIndexes.map((idx) => {
          const meta = SUPPLIER_STEPS[idx];
          const open = Boolean(expanded[idx]);
          const stepData = wizard.steps[meta.key];
          return (
            <div key={meta.key} className={`wizard-card ${open ? 'open' : 'collapsed'}`}>
              <button
                type="button"
                className="wizard-card-head"
                onClick={() => setExpanded((e) => ({ ...e, [idx]: !e[idx] }))}
              >
                <span>{meta.title}</span>
                <span className="wizard-card-meta">
                  {!open ? <em className="muted">{summaryLine(meta.key, stepData)}</em> : null}
                  <span className="wizard-chevron">{open ? '▾' : '▸'}</span>
                </span>
              </button>
              {open ? (
                <div className="wizard-card-body">
                  <StepForm
                    stepKey={meta.key}
                    data={stepData}
                    onChange={(d) => updateStepData(meta.key, d)}
                    onFile={handleFile}
                  />
                  <div className="action-row" style={{ marginTop: 12 }}>
                    <button type="button" className="btn" disabled={saving} onClick={() => onSaveCard(idx)}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setExpanded((e) => ({ ...e, [idx]: false }))}
                    >
                      Minimize
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="wizard-card active">
          <div className="wizard-card-head static">
            <span>{activeMeta.title}</span>
            <span className="engine-tag">
              {activeIndex + 1} / {SUPPLIER_STEPS.length}
            </span>
          </div>
          <div className="wizard-card-body">
            <StepForm
              stepKey={activeMeta.key}
              data={wizard.steps[activeMeta.key]}
              onChange={(d) => updateStepData(activeMeta.key, d)}
              onFile={handleFile}
            />
            <div className="action-row" style={{ marginTop: 16 }}>
              {activeIndex > 0 ? (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={saving}
                  onClick={() =>
                    setWizard((w) => ({
                      ...w,
                      currentStep: w.currentStep - 1,
                    }))
                  }
                >
                  Back
                </button>
              ) : null}
              <button type="button" className="btn" disabled={saving} onClick={onNext}>
                {saving
                  ? 'Saving…'
                  : activeIndex >= SUPPLIER_STEPS.length - 1
                    ? 'Finish & save'
                    : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
