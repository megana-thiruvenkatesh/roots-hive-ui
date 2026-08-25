import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAppAlerts } from '../../context/AppAlertsContext.jsx';
import HistoricResultCard from '../../components/HistoricResultCard.jsx';

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { pushToast, refreshUnread } = useAppAlerts();
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');
  const [expandedHistoric, setExpandedHistoric] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`/complaints/${id}`)
      .then((d) => {
        setComplaint(d.complaint);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function submitComplaint() {
    setSubmitting(true);
    setError('');
    try {
      const data = await api.post(`/complaints/${id}/submit`);
      setComplaint(data.complaint);
      pushToast(data.alreadySubmitted ? 'Already submitted' : 'Submitted to register (DB + CSV)', 'success');
      refreshUnread();
    } catch (err) {
      setError(err.message);
      pushToast(err.message || 'Submit failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !complaint) return <p style={{ color: 'var(--red)' }}>{error}</p>;
  if (!complaint) return <p className="muted">Loading…</p>;

  const wizard = complaint.wizardData || {};
  const fieldSources = wizard.fieldSources || {};
  const historicRecords = Array.isArray(wizard.historicRecords) ? wizard.historicRecords : [];
  const whyWhy = Array.isArray(complaint.whyWhy) ? complaint.whyWhy : [];
  const rejectionFeedback = wizard.rejectionFeedback || null;
  const canSubmit = complaint.stage === 'Approved' && complaint.createdBy === user?.id;
  const canResendAsSender =
    complaint.stage === 'Rejected' && complaint.createdBy === user?.id;

  return (
    <div style={{ maxWidth: 860 }}>
      <Link to="/notifications" className="muted" style={{ fontWeight: 700 }}>
        ← Back to Approval
      </Link>
      <Link to="/complaints" className="muted" style={{ fontWeight: 700, marginLeft: 14 }}>
        All Complaints
      </Link>

      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1>{complaint.id}</h1>
          <p>{complaint.desc}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${severityClass(complaint.severity)}`}>{complaint.severity}</span>
          <span className={`badge ${stageClass(complaint.stage)}`}>{complaint.stage}</span>
        </div>
      </div>

      {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}

      {rejectionFeedback ? (
        <div className="notif-feedback" style={{ marginBottom: 12 }}>
          <span className="kb-meta-label">Rejection feedback</span>
          <strong>{rejectionFeedback}</strong>
        </div>
      ) : null}

      {canResendAsSender ? (
        <div style={{ marginBottom: 12 }}>
          <Link className="btn" to={`/complaints/new?edit=${encodeURIComponent(complaint.id)}`}>
            Update &amp; resend approval
          </Link>
        </div>
      ) : null}

      {canSubmit ? (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn" disabled={submitting} onClick={submitComplaint}>
            {submitting ? 'Submitting…' : 'Submit complaint'}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            Admin approved — submit to register in DB + CSV log.
          </span>
        </div>
      ) : null}

      <div className="stack">
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Complaint Details</h3>
          <div className="hist-detail-list">
            <dl className="hist-detail-line">
              <Detail label="Type" value={complaint.type} />
              <Detail label="Severity" value={complaint.severity} />
              <Detail label="Defect / Symptom" value={complaint.defectCat} />
            </dl>
            <dl className="hist-detail-line">
              <Detail label="Part Code" value={complaint.partCode} />
              <Detail label="Part Name" value={complaint.part} />
              <Detail label="Supplier / Customer" value={complaint.customer} />
            </dl>
            <dl className="hist-detail-line">
              <Detail label="Lot Qty" value={complaint.lotQty} />
              <Detail label="Defect Qty" value={complaint.defectQty} />
              <Detail label="Rejection %" value={complaint.rejectionPct} />
            </dl>
            <dl className="hist-detail-line">
              <Detail label="Raised Date" value={complaint.raisedDate} />
              <Detail label="Created By" value={complaint.createdByName || user?.name} />
              <Detail label="Workflow Stage" value={complaint.stage} />
            </dl>
            <dl className="hist-detail-line full">
              <Detail label="Description" value={complaint.desc} wide />
            </dl>
          </div>
        </div>

        <div className="card">
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
            RCA {sourceHint(fieldSources.rootCause)}
          </label>
          <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', fontSize: 13.5 }}>
            {complaint.rootCause || '—'}
          </p>
        </div>

        <div className="card">
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
            Why-Why {sourceHint(fieldSources.whyWhy)}
          </label>
          {whyWhy.length ? (
            <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {whyWhy.map((line) => (
                <li key={line} style={{ marginBottom: 4, fontSize: 13.5 }}>{line}</li>
              ))}
            </ol>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>—</p>
          )}
        </div>

        <div className="card">
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
            Corrective Action (CA) {sourceHint(fieldSources.correctiveAction)}
          </label>
          <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', fontSize: 13.5 }}>
            {complaint.correctiveAction || '—'}
          </p>
        </div>

        <div className="card">
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
            Preventive Action (PA) {sourceHint(fieldSources.preventiveAction)}
          </label>
          <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0', fontSize: 13.5 }}>
            {complaint.preventiveAction || '—'}
          </p>
        </div>

        <div className="card">
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
            Selected Historic Record{historicRecords.length > 1 ? 's' : ''}
          </label>
          {!historicRecords.length ? (
            <p className="muted" style={{ margin: '8px 0 0' }}>
              No historic record was selected for this complaint (AI or manual entry only).
            </p>
          ) : (
            <div className="hist-stack" style={{ marginTop: 10 }}>
              {historicRecords.map((item) => (
                <div key={item.id}>
                  <p className="muted" style={{ margin: '0 0 6px', fontSize: 12 }}>
                    Used for: {fieldsUsingHistoric(fieldSources, item.id).join(', ') || 'Historic pick'}
                  </p>
                  <HistoricResultCard
                    item={item}
                    expanded={Boolean(expandedHistoric[item.id])}
                    onToggle={() =>
                      setExpandedHistoric((current) => ({
                        ...current,
                        [item.id]: !current[item.id],
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>History</label>
          <div className="stack" style={{ marginTop: 8 }}>
            {(complaint.history || []).map((h, i) => (
              <div
                key={`${h.date}-${h.action}-${i}`}
                style={{
                  fontSize: 12.5,
                  color: 'var(--text2)',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {h.date} — {h.action} ({h.by})
              </div>
            ))}
            {!complaint.history?.length ? <p className="muted">No history yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, wide }) {
  return (
    <div className={`hist-detail-cell${wide ? ' wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{value == null || value === '' ? '—' : String(value)}</dd>
    </div>
  );
}

function sourceHint(meta) {
  if (!meta?.source) return null;
  if (meta.source === 'historic' && meta.historicLabel) {
    return <span className="muted" style={{ fontWeight: 600 }}> · Historic: {meta.historicLabel}</span>;
  }
  if (meta.source === 'ai') {
    return <span className="muted" style={{ fontWeight: 600 }}> · AI Suggested</span>;
  }
  return <span className="muted" style={{ fontWeight: 600 }}> · Manual</span>;
}

function fieldsUsingHistoric(fieldSources, historicId) {
  const labels = {
    rootCause: 'RCA',
    whyWhy: 'Why-Why',
    correctiveAction: 'CA',
    preventiveAction: 'PA',
  };
  return Object.entries(fieldSources || {})
    .filter(([, meta]) => meta?.source === 'historic' && meta?.historicId === historicId)
    .map(([key]) => labels[key] || key);
}

function severityClass(s) {
  if (s === 'Critical') return 'critical';
  if (s === 'Major') return 'major';
  if (s === 'Minor') return 'minor';
  return '';
}

function stageClass(stage) {
  if (stage === 'Closed' || stage === 'Approved' || stage === 'Open') return 'open';
  if (stage === 'Rejected') return 'critical';
  if (stage === 'Pending Approval') return 'major';
  return 'minor';
}
