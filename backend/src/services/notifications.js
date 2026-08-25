const pool = require('../db/pool');

let ready = false;

async function ensureNotificationsTable() {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      type          VARCHAR(60) NOT NULL,
      title         VARCHAR(255) NOT NULL,
      body          TEXT,
      complaint_id  VARCHAR(40),
      meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created
      ON notifications(user_id, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_complaint_type
      ON notifications(user_id, complaint_id, type)
  `);
  ready = true;
}

/** Map live complaint stage → notification badge / actions */
function approvalStateFromStage(stage, wizard = {}) {
  const s = String(stage || '').trim();
  if (s === 'Pending Approval') {
    return {
      resolution: null,
      badge: 'PENDING',
      stage: s,
      canApprove: true,
      canReject: true,
      canResend: false,
      canSubmit: false,
    };
  }
  if (s === 'Rejected') {
    return {
      resolution: 'REJECTED',
      badge: 'REJECTED',
      stage: s,
      feedback: wizard.rejectionFeedback || null,
      // Admin cannot act after reject — sender must update & resend
      canApprove: false,
      canReject: false,
      canResend: true,
      canSubmit: false,
    };
  }
  if (s === 'Draft') {
    const wasInFlow =
      wizard.approvalStatus === 'REJECTED' ||
      wizard.approvalStatus === 'PENDING' ||
      Boolean(wizard.approvalSentAt);
    return {
      resolution: wasInFlow ? 'UPDATING' : null,
      badge: wasInFlow ? 'UPDATING' : 'DRAFT',
      stage: s,
      feedback: wizard.rejectionFeedback || null,
      canApprove: false,
      canReject: false,
      canResend: true,
      canSubmit: false,
    };
  }
  // Admin approved — sender must Submit to register the complaint
  if (s === 'Approved') {
    return {
      resolution: 'APPROVED',
      badge: 'APPROVED',
      stage: s,
      feedback: wizard.approvalFeedback || null,
      canApprove: false,
      canReject: false,
      canResend: false,
      canSubmit: true,
    };
  }
  // Submitted / registered in complaint register
  if (['Open', 'In Progress', 'Closed', 'Verified'].includes(s) || wizard.submittedAt) {
    return {
      resolution: 'SUBMITTED',
      badge: 'SUBMITTED',
      stage: s,
      canApprove: false,
      canReject: false,
      canResend: false,
      canSubmit: false,
    };
  }
  return {
    resolution: null,
    badge: (s || 'UNKNOWN').toUpperCase(),
    stage: s,
    canApprove: false,
    canReject: false,
    canResend: false,
    canSubmit: false,
  };
}

async function createNotification({
  userId,
  senderId = null,
  type,
  title,
  body = '',
  complaintId = null,
  meta = {},
}) {
  await ensureNotificationsTable();
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, sender_id, type, title, body, complaint_id, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     RETURNING *`,
    [userId, senderId, type, title, body, complaintId, JSON.stringify(meta || {})]
  );
  return rows[0];
}

/**
 * One thread card per user + complaint + type.
 * Updates the existing row (title/body/meta/log) instead of inserting duplicates.
 */
async function upsertComplaintNotification({
  userId,
  senderId = null,
  type,
  title,
  body = '',
  complaintId,
  metaPatch = {},
  logEntry = null,
  markUnread = true,
  clearResolution = false,
}) {
  await ensureNotificationsTable();
  if (!userId || !complaintId || !type) {
    throw new Error('userId, complaintId and type are required');
  }

  const { rows: existing } = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = $1 AND complaint_id = $2 AND type = $3
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId, complaintId, type]
  );

  const nowIso = new Date().toISOString();
  const prevMeta = existing[0]?.meta && typeof existing[0].meta === 'object' ? existing[0].meta : {};
  const log = Array.isArray(prevMeta.log) ? [...prevMeta.log] : [];
  if (logEntry) {
    log.push({
      at: nowIso,
      event: logEntry.event,
      by: logEntry.by || null,
      detail: logEntry.detail || '',
    });
  }

  let meta = { ...prevMeta, ...metaPatch, log };
  if (clearResolution) {
    meta = {
      ...meta,
      resolution: null,
      feedback: null,
      resolvedAt: null,
      waitingForResend: false,
      badge: meta.badge === 'REJECTED' || meta.badge === 'UPDATING' ? 'PENDING' : meta.badge || 'PENDING',
    };
  }

  await pool.query(
    `DELETE FROM notifications
     WHERE user_id = $1
       AND complaint_id = $2
       AND type IN ('approval_approved', 'approval_rejected')`,
    [userId, complaintId]
  );

  if (existing[0]) {
    await pool.query(
      `DELETE FROM notifications
       WHERE user_id = $1 AND complaint_id = $2 AND type = $3 AND id <> $4`,
      [userId, complaintId, type, existing[0].id]
    );

    const { rows } = await pool.query(
      `UPDATE notifications
       SET sender_id = COALESCE($1, sender_id),
           title = $2,
           body = $3,
           meta = $4::jsonb,
           read_at = CASE WHEN $5 THEN NULL ELSE read_at END,
           updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [senderId, title, body, JSON.stringify(meta), markUnread, existing[0].id]
    );
    return rows[0];
  }

  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, sender_id, type, title, body, complaint_id, meta, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb, now())
     RETURNING *`,
    [userId, senderId, type, title, body, complaintId, JSON.stringify(meta)]
  );
  return rows[0];
}

/**
 * Heal all approval thread cards for a complaint from the live DB stage.
 */
async function syncApprovalNotificationsFromComplaint(complaintId, { appendLog = null } = {}) {
  await ensureNotificationsTable();
  const { rows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [complaintId]);
  const complaint = rows[0];
  if (!complaint) return null;

  const wizard = complaint.wizard_data || {};
  const state = approvalStateFromStage(complaint.stage, wizard);
  const id = complaint.id;

  let body = '';
  if (state.badge === 'PENDING') {
    body = 'Waiting for admin approval.';
  } else if (state.badge === 'REJECTED') {
    body = state.feedback
      ? `Rejected. Feedback: ${state.feedback}`
      : 'Rejected — update and resend for approval.';
  } else if (state.badge === 'UPDATING' || state.badge === 'DRAFT') {
    body = 'Sender is updating this complaint before re-sending for approval.';
  } else if (state.badge === 'APPROVED') {
    body = state.feedback
      ? `Approved. Feedback: ${state.feedback} — sender can Submit to register.`
      : 'Admin approved — sender can Submit to register the complaint.';
  } else if (state.badge === 'SUBMITTED') {
    body = `Submitted to complaint register · stage ${complaint.stage || 'Open'}.`;
  } else {
    body = `Current stage: ${complaint.stage || '—'}`;
  }

  const { rows: notifs } = await pool.query(
    `SELECT * FROM notifications
     WHERE complaint_id = $1
       AND type IN ('approval_request', 'approval_sent')`,
    [id]
  );

  for (const n of notifs) {
    const prevMeta = n.meta && typeof n.meta === 'object' ? n.meta : {};
    const log = Array.isArray(prevMeta.log) ? [...prevMeta.log] : [];
    if (appendLog) {
      log.push({
        at: new Date().toISOString(),
        event: appendLog.event,
        by: appendLog.by || null,
        detail: appendLog.detail || '',
      });
    }
    const meta = {
      ...prevMeta,
      resolution: state.resolution,
      stage: state.stage,
      feedback: state.feedback || prevMeta.feedback || null,
      badge: state.badge,
      canApprove: state.canApprove && n.type === 'approval_request',
      canReject: state.canReject && n.type === 'approval_request',
      canResend: state.canResend && n.type === 'approval_sent',
      canSubmit: state.canSubmit && n.type === 'approval_sent',
      waitingForResend:
        n.type === 'approval_request' &&
        (state.badge === 'REJECTED' || state.badge === 'UPDATING' || state.badge === 'DRAFT'),
      log,
    };

    const isRequest = n.type === 'approval_request';
    const title =
      state.badge === 'SUBMITTED'
        ? `Submitted · ${id}`
        : state.badge === 'APPROVED'
          ? `Approved · ${id}`
          : state.badge === 'REJECTED'
            ? `Rejected · ${id}`
            : state.badge === 'UPDATING' || state.badge === 'DRAFT'
              ? `Updating · ${id}`
              : isRequest
                ? `Approval requested · ${id}`
                : `Approval · ${id}`;

    await pool.query(
      `UPDATE notifications
       SET title = $1,
           body = $2,
           meta = $3::jsonb,
           updated_at = now()
       WHERE id = $4`,
      [title, body, JSON.stringify(meta), n.id]
    );
  }

  return state;
}

async function findAdminUser() {
  const { rows } = await pool.query(
    `SELECT id, name, email, role_key
     FROM users
     WHERE is_admin = true OR role_key = 'ADMIN' OR lower(email) LIKE 'vivin@%'
     ORDER BY CASE WHEN lower(email) LIKE 'vivin@%' THEN 0 ELSE 1 END, created_at ASC
     LIMIT 1`
  );
  return rows[0] || null;
}

module.exports = {
  ensureNotificationsTable,
  createNotification,
  upsertComplaintNotification,
  syncApprovalNotificationsFromComplaint,
  approvalStateFromStage,
  findAdminUser,
};
