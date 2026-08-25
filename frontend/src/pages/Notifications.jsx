import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppAlerts } from '../context/AppAlertsContext.jsx';

function formatWhen(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function statusLabel(n) {
  const badge = n.meta?.badge || n.meta?.resolution;
  if (badge === 'SUBMITTED' || n.meta?.resolution === 'SUBMITTED') return { text: 'SUBMITTED', tone: 'ok' };
  if (badge === 'APPROVED' || n.meta?.resolution === 'APPROVED') return { text: 'APPROVED', tone: 'ok' };
  if (badge === 'REJECTED' || n.meta?.resolution === 'REJECTED') return { text: 'REJECTED', tone: 'bad' };
  if (badge === 'UPDATING' || badge === 'DRAFT') return { text: 'UPDATING', tone: 'mid' };
  if (n.type === 'approval_request' || n.type === 'approval_sent') return { text: 'PENDING', tone: 'mid' };
  return { text: String(n.type || 'INFO').replace(/_/g, ' ').toUpperCase(), tone: 'mid' };
}

function eventLabel(event) {
  switch (event) {
    case 'SENT':
      return 'Sent for approval';
    case 'RESENT':
      return 'Updated & re-sent';
    case 'UPDATED':
      return 'Updated (draft)';
    case 'REJECTED':
      return 'Rejected';
    case 'APPROVED':
      return 'Approved';
    case 'SUBMITTED':
      return 'Submitted to register';
    default:
      return String(event || 'Update').replace(/_/g, ' ');
  }
}

export default function Notifications() {
  const { user } = useAuth();
  const { pushToast, refreshUnread } = useAppAlerts();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { mode: 'approve'|'reject', complaintId, notificationId }
  const [modalText, setModalText] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/notifications')
      .then((data) => {
        setError('');
        setItems(data.notifications || []);
      })
      .catch((err) => {
        // Keep showing last good list; only surface persistent failures
        const msg = err.message || 'Failed to load notifications';
        if (/ECONNREFUSED|Failed to fetch|NetworkError|Request failed \(5\d{2}\)/i.test(msg)) {
          // Transient backend restart / proxy blip — retry quietly next poll
          setError('');
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      load();
      refreshUnread();
    } catch {
      /* ignore */
    }
  }

  async function approve(complaintId, notificationId, text) {
    setBusyId(notificationId);
    setError('');
    try {
      const data = await api.post(`/complaints/${complaintId}/approve`, { feedback: text });
      if (data?.alreadyApproved) {
        pushToast('Already approved — card refreshed', 'success');
      } else {
        pushToast('Complaint approved — sender can submit', 'success');
      }
      await markRead(notificationId);
      setActionModal(null);
      setModalText('');
      load();
      refreshUnread();
    } catch (err) {
      setError(err.message);
      pushToast(err.message || 'Approve failed', 'error');
      load();
      refreshUnread();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(complaintId, notificationId, text) {
    setBusyId(notificationId);
    setError('');
    try {
      await api.post(`/complaints/${complaintId}/reject`, { feedback: text });
      pushToast('Complaint rejected — sender notified', 'success');
      await markRead(notificationId);
      setActionModal(null);
      setModalText('');
      load();
      refreshUnread();
    } catch (err) {
      setError(err.message);
      pushToast(err.message || 'Reject failed', 'error');
      load();
      refreshUnread();
    } finally {
      setBusyId(null);
    }
  }

  function openActionModal(mode, complaintId, notificationId) {
    setModalText('');
    setActionModal({ mode, complaintId, notificationId });
  }

  function confirmActionModal() {
    if (!actionModal) return;
    const text = String(modalText || '').trim();
    if (!text) {
      const msg =
        actionModal.mode === 'approve'
          ? 'Positive feedback is required to approve'
          : 'Rejection feedback is required';
      setError(msg);
      pushToast(msg, 'error');
      return;
    }
    if (actionModal.mode === 'approve') {
      approve(actionModal.complaintId, actionModal.notificationId, text);
    } else {
      reject(actionModal.complaintId, actionModal.notificationId, text);
    }
  }

  async function submitComplaint(complaintId, notificationId) {
    setBusyId(notificationId);
    setError('');
    try {
      const data = await api.post(`/complaints/${complaintId}/submit`);
      if (data?.alreadySubmitted) {
        pushToast('Already submitted — card refreshed', 'success');
      } else {
        pushToast('Complaint submitted to register (DB + CSV)', 'success');
      }
      await markRead(notificationId);
      load();
      refreshUnread();
    } catch (err) {
      setError(err.message);
      pushToast(err.message || 'Submit failed', 'error');
      load();
    } finally {
      setBusyId(null);
    }
  }

  const canAct = user?.roleKey === 'ADMIN' || user?.roleKey === 'QUALITY_HEAD' || user?.isAdmin;

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1>Approval</h1>
          <p>
            One card per complaint — status changes on the same approval
            (Pending → Rejected → Approved → Submitted). Activity log keeps the history.
          </p>
        </div>
        <button
          type="button"
          className="btn secondary notif-btn"
          onClick={() => api.post('/notifications/mark-all-read').then(() => { load(); refreshUnread(); })}
        >
          Mark all read
        </button>
      </div>

      {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}
      {loading && !items.length ? <p className="muted">Loading…</p> : null}

      <div className="notif-list">
        {!loading && !items.length ? (
          <div className="card" style={{ padding: 20 }}>
            <p className="muted" style={{ margin: 0 }}>No approvals yet.</p>
          </div>
        ) : null}

        {items.map((n) => {
          const isUnread = !n.readAt;
          const status = statusLabel(n);
          const isRequest = n.type === 'approval_request';
          const isSent = n.type === 'approval_sent';
          const badge = n.meta?.badge || n.meta?.resolution;
          const isRejected = badge === 'REJECTED';
          const isPending = badge === 'PENDING' || (!badge && isRequest && !n.meta?.resolution);
          const rejectFb = n.meta?.feedback || '';
          const isApproved = badge === 'APPROVED';
          const log = Array.isArray(n.meta?.log) ? n.meta.log : [];
          const isOwner = String(n.complaintCreatedBy || '') === String(user?.id || '');
          // Sender tracking card only — never on admin request cards
          const canResend =
            n.type === 'approval_sent' &&
            isOwner &&
            Boolean(n.meta?.canResend) &&
            n.complaintId &&
            (isRejected || badge === 'UPDATING' || badge === 'DRAFT');
          const canSubmit =
            n.type === 'approval_sent' &&
            isOwner &&
            Boolean(n.meta?.canSubmit) &&
            n.complaintId &&
            badge === 'APPROVED';
          // Admin actions only on pending request cards
          const canApprove = canAct && Boolean(n.meta?.canApprove) && isRequest && isPending;
          const canReject = canAct && Boolean(n.meta?.canReject) && isRequest && isPending;

          return (
            <article key={n.id} className={`card notif-card${isUnread ? ' unread' : ''}`}>
              <div className="notif-card-top">
                <div>
                  <strong>{n.title}</strong>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Updated {formatWhen(n.updatedAt || n.createdAt)}
                    {n.complaintStage ? ` · stage ${n.complaintStage}` : ''}
                    {n.senderName || n.senderEmail ? ` · from ${n.senderName || n.senderEmail}` : ''}
                  </div>
                </div>
                <span className={`kb-status ${status.tone}`}>
                  <i /> {status.text}
                </span>
              </div>
              <p style={{ margin: '10px 0', fontSize: 13.5 }}>{n.body}</p>
              {isRejected && rejectFb ? (
                <div className="notif-feedback">
                  <span className="kb-meta-label">Rejection feedback</span>
                  <strong>{rejectFb}</strong>
                </div>
              ) : null}
              {isApproved && rejectFb ? (
                <div className="notif-feedback ok">
                  <span className="kb-meta-label">Approval feedback</span>
                  <strong>{rejectFb}</strong>
                </div>
              ) : null}
              {log.length ? (
                <div className="notif-log">
                  <span className="kb-meta-label">Activity</span>
                  <ul>
                    {log.map((entry, idx) => (
                      <li key={`${entry.at || idx}-${entry.event || idx}`}>
                        <strong>{eventLabel(entry.event)}</strong>
                        <span className="muted">
                          {entry.at ? ` · ${formatWhen(entry.at)}` : ''}
                          {entry.by ? ` · ${entry.by}` : ''}
                        </span>
                        {entry.detail ? <div className="notif-log-detail">{entry.detail}</div> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="notif-actions">
                {n.complaintId ? (
                  <Link className="btn secondary notif-btn" to={`/complaints/${n.complaintId}`} onClick={() => markRead(n.id)}>
                    Open complaint
                  </Link>
                ) : null}
                {canResend ? (
                  <Link
                    className="btn notif-btn"
                    to={`/complaints/new?edit=${encodeURIComponent(n.complaintId)}`}
                  >
                    Update &amp; resend
                  </Link>
                ) : null}
                {canSubmit ? (
                  <button
                    type="button"
                    className="btn notif-btn"
                    disabled={busyId === n.id}
                    onClick={() => submitComplaint(n.complaintId, n.id)}
                  >
                    {busyId === n.id ? 'Submitting…' : 'Submit complaint'}
                  </button>
                ) : null}
                {isUnread ? (
                  <button type="button" className="btn secondary notif-btn" onClick={() => markRead(n.id)}>Mark read</button>
                ) : null}
                {canApprove ? (
                  <button
                    type="button"
                    className="btn notif-btn"
                    disabled={busyId === n.id}
                    onClick={() => openActionModal('approve', n.complaintId, n.id)}
                  >
                    Approve
                  </button>
                ) : null}
                {canReject ? (
                  <button
                    type="button"
                    className="btn notif-btn notif-btn-reject"
                    disabled={busyId === n.id}
                    onClick={() => openActionModal('reject', n.complaintId, n.id)}
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {actionModal ? (
        <div className="notif-modal-backdrop" role="presentation" onClick={() => !busyId && setActionModal(null)}>
          <div
            className="notif-modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="notif-modal-title">
              {actionModal.mode === 'approve' ? 'Approval feedback' : 'Rejection feedback'}
            </h3>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 12.5 }}>
              {actionModal.mode === 'approve'
                ? 'Enter positive feedback for the sender, then confirm Approve.'
                : 'Enter rejection feedback for the sender, then confirm Reject.'}
            </p>
            <textarea
              className="input"
              rows={4}
              autoFocus
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              placeholder={
                actionModal.mode === 'approve'
                  ? 'Positive feedback (required)'
                  : 'Rejection feedback (required)'
              }
            />
            <div className="notif-modal-actions">
              <button
                type="button"
                className="btn secondary notif-btn"
                disabled={Boolean(busyId)}
                onClick={() => {
                  setActionModal(null);
                  setModalText('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn notif-btn${actionModal.mode === 'reject' ? ' notif-btn-reject' : ''}`}
                disabled={Boolean(busyId)}
                onClick={confirmActionModal}
              >
                {busyId
                  ? 'Saving…'
                  : actionModal.mode === 'approve'
                    ? 'Confirm Approve'
                    : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
