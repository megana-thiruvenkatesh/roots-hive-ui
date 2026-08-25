const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { canDeleteCapa, ROLES } = require('../services/roles');
const {
  findSimilarHistoric,
  buildAiSuggestion,
} = require('../services/typeDataSources');
const { writeAuditLog } = require('../services/auditLog');
const {
  upsertComplaintNotification,
  syncApprovalNotificationsFromComplaint,
  findAdminUser,
} = require('../services/notifications');
const { appendComplaintRegister } = require('../services/complaintRegister');

const router = express.Router();
router.use(requireAuth);

function rowToComplaint(r) {
  return {
    id: r.id,
    type: r.type,
    desc: r.description,
    part: r.part,
    partCode: r.part_code,
    customer: r.customer,
    defectCat: r.defect_category,
    severity: r.severity,
    process: r.process,
    stage: r.stage,
    raisedDate: r.raised_date,
    rootCause: r.root_cause,
    correctiveAction: r.corrective_action,
    preventiveAction: r.preventive_action,
    whyWhy: r.why_why || [],
    cftTeam: r.cft_team,
    lotQty: r.lot_qty,
    defectQty: r.defect_qty,
    rejectionPct: r.rejection_pct,
    assignedTo: r.assigned_to,
    assignedName: r.assigned_name || null,
    createdBy: r.created_by,
    createdByName: r.created_by_name || null,
    history: r.history || [],
    tasks: r.tasks || [],
    attachments: r.attachments || [],
    wizardData: r.wizard_data || {},
    updatedAt: r.updated_at,
  };
}

const LIST_SQL = `
  SELECT c.*,
         a.name AS assigned_name,
         cr.name AS created_by_name
  FROM complaints c
  LEFT JOIN users a ON a.id = c.assigned_to
  LEFT JOIN users cr ON cr.id = c.created_by
`;

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`${LIST_SQL} ORDER BY c.raised_date DESC, c.created_at DESC`);
    let complaints = rows.map(rowToComplaint);
    if (req.user.roleKey === 'QUALITY_EMPLOYEE' || req.user.roleKey === 'QUALITY_WORKER') {
      complaints = complaints.filter(
        (c) => c.assignedTo === req.user.id || c.createdBy === req.user.id
      );
    }
    res.json({ complaints });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list complaints' });
  }
});

router.get('/search', async (req, res) => {
  const { q = '', defectCat, severity, stage, year, process: processFilter } = req.query;
  const clauses = [];
  const params = [];
  let i = 1;

  if (q.trim()) {
    clauses.push(`to_tsvector('english',
        coalesce(c.description,'') || ' ' || coalesce(c.part,'') || ' ' || coalesce(c.customer,'') || ' ' ||
        coalesce(c.defect_category,'') || ' ' || coalesce(c.root_cause,'') || ' ' ||
        coalesce(c.corrective_action,'') || ' ' || coalesce(c.preventive_action,'')
      ) @@ plainto_tsquery('english', $${i})`);
    params.push(q);
    i++;
  }
  if (defectCat && defectCat !== 'All') {
    clauses.push(`c.defect_category = $${i}`);
    params.push(defectCat);
    i++;
  }
  if (severity && severity !== 'All') {
    clauses.push(`c.severity = $${i}`);
    params.push(severity);
    i++;
  }
  if (stage && stage !== 'All') {
    clauses.push(`c.stage = $${i}`);
    params.push(stage);
    i++;
  }
  if (processFilter && processFilter !== 'All') {
    clauses.push(`c.process = $${i}`);
    params.push(processFilter);
    i++;
  }
  if (year && year !== 'All') {
    clauses.push(`extract(year from c.raised_date) = $${i}`);
    params.push(Number(year));
    i++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${LIST_SQL} ${where} ORDER BY c.raised_date DESC LIMIT 200`,
    params
  );
  res.json({ complaints: rows.map(rowToComplaint) });
});

router.get('/meta/assignees', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, role_label, dept FROM users
     WHERE role_key IN ('QUALITY_EMPLOYEE','QUALITY_HEAD','QUALITY_MANAGER','ADMIN','QUALITY_WORKER','DEPT_HOD')
     ORDER BY name`
  );
  res.json({ users: rows });
});

/** Similar historic cases from type-scoped file/KB/DB sources */
router.post('/similar', async (req, res) => {
  try {
    const { type, description, defectCat, part } = req.body || {};
    const matches = await findSimilarHistoric(pool, {
      type,
      description,
      defectCat,
      part,
    });
    const suggestion = buildAiSuggestion({
      type,
      description,
      defectCat,
      matches,
    });
    await writeAuditLog({
      user: req.user,
      module: 'New Complaint',
      action: 'Historic match search',
      detail: `${matches.length} match(es) for ${type || 'Internal'} · ${defectCat || '—'}`,
      meta: { type, defectCat, matchCount: matches.length },
    });
    res.json({ matches, suggestion });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to find similar historic cases' });
  }
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ complaint: rowToComplaint(rows[0]) });
});

async function nextComplaintId() {
  const year = new Date().getFullYear();
  // Use MAX sequence — COUNT+1 breaks after deletions (reuses existing IDs).
  const { rows } = await pool.query(
    `SELECT COALESCE(
       MAX(NULLIF(substring(id from 'CAPA-\\d+-([0-9]+)'), '')::int),
       0
     ) AS n
     FROM complaints
     WHERE id LIKE $1`,
    [`CAPA-${year}-%`]
  );
  const seq = String((rows[0]?.n || 0) + 1).padStart(4, '0');
  return `CAPA-${year}-${seq}`;
}

function asHistoryArray(history) {
  return Array.isArray(history) ? history : [];
}

function historyEntry(action, by) {
  return { date: new Date().toLocaleString(), action, by };
}

/** Create or update a Draft complaint (Save / Save & Next). */
router.post('/draft', async (req, res) => {
  if (req.user.roleKey === 'QUALITY_SUPPORT') {
    return res.status(403).json({ error: 'Quality Support cannot create complaints' });
  }
  const c = req.body || {};
  const desc = (c.desc || '').trim();
  if (!desc) return res.status(400).json({ error: 'Description is required' });

  try {
    let id = c.id;
    if (id) {
      const { rows: existing } = await pool.query('SELECT * FROM complaints WHERE id = $1', [id]);
      if (!existing[0]) return res.status(404).json({ error: 'Draft not found' });
      if (existing[0].created_by !== req.user.id && req.user.roleKey !== 'ADMIN') {
        return res.status(403).json({ error: 'Not your draft' });
      }
      if (!['Draft', 'Rejected'].includes(existing[0].stage)) {
        return res.status(400).json({ error: 'Only Draft/Rejected complaints can be updated as draft' });
      }
      const history = [
        ...asHistoryArray(existing[0].history),
        historyEntry(c.saveLabel || 'Draft saved', req.user.name || req.user.email),
      ];
      const wizard = { ...(existing[0].wizard_data || {}), ...(c.wizardData || {}) };
      await pool.query(
        `UPDATE complaints SET
           type=$1, description=$2, part=$3, part_code=$4, customer=$5, defect_category=$6,
           severity=$7, stage='Draft', raised_date=$8, root_cause=$9, corrective_action=$10,
           preventive_action=$11, why_why=$12::jsonb, lot_qty=$13, defect_qty=$14, rejection_pct=$15,
           history=$16::jsonb, wizard_data=$17::jsonb, updated_at=now()
         WHERE id=$18`,
        [
          c.type || existing[0].type,
          desc,
          c.part || null,
          c.partCode || null,
          c.customer || null,
          c.defectCat || null,
          c.severity || existing[0].severity,
          c.raisedDate || existing[0].raised_date,
          c.rootCause || null,
          c.correctiveAction || null,
          c.preventiveAction || null,
          JSON.stringify(c.whyWhy || []),
          c.lotQty ?? null,
          c.defectQty ?? null,
          c.rejectionPct ?? null,
          JSON.stringify(history),
          JSON.stringify(wizard),
          id,
        ]
      );
    } else {
      id = await nextComplaintId();
      const history = [historyEntry(c.saveLabel || 'Draft created', req.user.name || req.user.email)];
      await pool.query(
        `INSERT INTO complaints
          (id, type, description, part, part_code, customer, defect_category, severity, process, stage,
           raised_date, root_cause, corrective_action, preventive_action, why_why, cft_team,
           lot_qty, defect_qty, rejection_pct, history, tasks, attachments, wizard_data, assigned_to, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Draft',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'[]'::jsonb,'[]'::jsonb,$20,$21,$21)`,
        [
          id,
          c.type || 'Internal',
          desc,
          c.part || null,
          c.partCode || null,
          c.customer || null,
          c.defectCat || null,
          c.severity || 'Major',
          c.process || null,
          c.raisedDate || new Date().toISOString().slice(0, 10),
          c.rootCause || null,
          c.correctiveAction || null,
          c.preventiveAction || null,
          JSON.stringify(c.whyWhy || []),
          c.cftTeam || null,
          c.lotQty ?? null,
          c.defectQty ?? null,
          c.rejectionPct ?? null,
          JSON.stringify(history),
          JSON.stringify(c.wizardData || {}),
          req.user.id,
        ]
      );
    }

    await writeAuditLog({
      user: req.user,
      module: 'New Complaint',
      action: c.saveLabel || 'Draft saved',
      detail: `${id} saved as Draft`,
      meta: { complaintId: id, stage: 'Draft' },
    });

    // Keep approval thread cards in sync when sender re-edits after reject/send
    if (c.id) {
      const { rows: thread } = await pool.query(
        `SELECT 1 FROM notifications
         WHERE complaint_id = $1 AND type IN ('approval_sent', 'approval_request')
         LIMIT 1`,
        [id]
      );
      if (thread[0]) {
        await syncApprovalNotificationsFromComplaint(id, {
          appendLog: {
            event: 'UPDATED',
            by: req.user.name || req.user.email,
            detail: c.saveLabel || 'Draft saved',
          },
        });
      }
    }

    const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [id]);
    res.status(id && c.id ? 200 : 201).json({ complaint: rowToComplaint(full[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to save draft' });
  }
});

/** Sender → admin approval request (first send or re-send after reject) */
router.post('/:id/send-approval', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    if (row.created_by !== req.user.id && req.user.roleKey !== 'ADMIN') {
      return res.status(403).json({ error: 'Only the sender can request approval' });
    }
    if (!['Draft', 'Rejected', 'Pending Approval'].includes(String(row.stage || ''))) {
      return res.status(400).json({
        error: `Cannot send approval from stage "${row.stage || 'unknown'}"`,
      });
    }
    if (!row.root_cause || !(row.why_why && row.why_why.length) || !row.corrective_action || !row.preventive_action) {
      return res.status(400).json({ error: 'RCA, Why-Why, CA and PA must be filled before send approval' });
    }

    const admin = await findAdminUser();
    if (!admin) return res.status(500).json({ error: 'No admin user found for approval' });

    const wizardPrev = row.wizard_data || {};
    const wasRejected =
      String(row.stage) === 'Rejected' ||
      wizardPrev.approvalStatus === 'REJECTED' ||
      Boolean(wizardPrev.rejectionFeedback);
    const actor = req.user.name || req.user.email;
    const history = [
      ...asHistoryArray(row.history),
      historyEntry(
        wasRejected
          ? `Re-sent for approval to ${admin.name || admin.email}`
          : `Approval sent to ${admin.name || admin.email}`,
        actor
      ),
    ];
    const wizard = {
      ...(row.wizard_data || {}),
      approvalStatus: 'PENDING',
      approvalSentAt: new Date().toISOString(),
      approvalAdminId: admin.id,
      rejectionFeedback: null,
      approvalFeedback: null,
    };

    await pool.query(
      `UPDATE complaints
       SET stage = 'Pending Approval', history = $1::jsonb, wizard_data = $2::jsonb, updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(history), JSON.stringify(wizard), row.id]
    );

    const sendDetail = wasRejected
      ? `${actor} updated and re-sent ${row.id} for approval.`
      : `${actor} sent complaint ${row.id} for approval.`;

    // Admin: SAME request card updated in place on re-send (never a new notification)
    await upsertComplaintNotification({
      userId: admin.id,
      senderId: req.user.id,
      type: 'approval_request',
      title: `Approval requested · ${row.id}`,
      body: sendDetail,
      complaintId: row.id,
      clearResolution: true,
      markUnread: true,
      metaPatch: {
        from: req.user.email,
        stage: 'Pending Approval',
        badge: 'PENDING',
        lastEvent: wasRejected ? 'RESENT' : 'SENT',
        waitingForResend: false,
        canApprove: true,
        canReject: true,
        canResend: false,
        canSubmit: false,
      },
      logEntry: {
        event: wasRejected ? 'RESENT' : 'SENT',
        by: actor,
        detail: sendDetail,
      },
    });

    // Sender: SAME tracking card updated in place
    await upsertComplaintNotification({
      userId: req.user.id,
      senderId: req.user.id,
      type: 'approval_sent',
      title: `Approval · ${row.id}`,
      body: wasRejected
        ? `Updated and re-sent to ${admin.name || admin.email}. Waiting for approval.`
        : `Sent to ${admin.name || admin.email} for approval.`,
      complaintId: row.id,
      clearResolution: true,
      markUnread: false,
      metaPatch: {
        to: admin.email,
        stage: 'Pending Approval',
        badge: 'PENDING',
        lastEvent: wasRejected ? 'RESENT' : 'SENT',
        waitingForResend: false,
        canApprove: false,
        canReject: false,
        canResend: false,
        canSubmit: false,
      },
      logEntry: {
        event: wasRejected ? 'RESENT' : 'SENT',
        by: actor,
        detail: wasRejected
          ? `Re-sent to ${admin.name || admin.email}`
          : `Sent to ${admin.name || admin.email}`,
      },
    });

    await writeAuditLog({
      user: req.user,
      module: 'New Complaint',
      action: wasRejected ? 'Approval re-sent' : 'Approval sent',
      detail: `${row.id} → ${admin.email}`,
      meta: { complaintId: row.id, adminId: admin.id, wasRejected },
    });

    await syncApprovalNotificationsFromComplaint(row.id);

    const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [row.id]);
    res.json({ complaint: rowToComplaint(full[0]), admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to send approval' });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    if (!['ADMIN', 'QUALITY_HEAD'].includes(req.user.roleKey) && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Only admin can approve' });
    }
    const feedback = String(req.body?.feedback || '').trim();
    if (!feedback) return res.status(400).json({ error: 'Approval feedback is required' });

    const { rows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    const stage = String(row.stage || '').trim();

    // Already submitted/registered
    if (['Open', 'In Progress', 'Closed', 'Verified'].includes(stage)) {
      await syncApprovalNotificationsFromComplaint(row.id);
      const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [row.id]);
      return res.json({
        complaint: rowToComplaint(full[0]),
        alreadyApproved: true,
        message: 'Complaint is already submitted',
      });
    }

    // Already approved — waiting for sender Submit
    if (stage === 'Approved') {
      await syncApprovalNotificationsFromComplaint(row.id);
      const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [row.id]);
      return res.json({
        complaint: rowToComplaint(full[0]),
        alreadyApproved: true,
        message: 'Already approved — sender must Submit to register',
      });
    }

    // Sender mid-edit after reject — heal cards; ask admin to wait
    if (stage === 'Draft') {
      await syncApprovalNotificationsFromComplaint(row.id);
      return res.status(400).json({
        error: 'Sender is still updating this complaint. Wait until they Send Approval again.',
      });
    }

    // Allow approve only while pending (after reject, wait for sender re-send)
    if (stage !== 'Pending Approval') {
      await syncApprovalNotificationsFromComplaint(row.id);
      return res.status(400).json({
        error:
          stage === 'Rejected' || stage === 'Draft'
            ? 'Waiting for sender to update and re-send approval.'
            : `Cannot approve from stage "${stage || 'unknown'}". Complaint must be Pending Approval.`,
      });
    }

    const actor = req.user.name || req.user.email;
    const history = [
      ...asHistoryArray(row.history),
      historyEntry(`Approved: ${feedback} — awaiting submit`, actor),
    ];
    const wizard = {
      ...(row.wizard_data || {}),
      approvalStatus: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedBy: req.user.id,
      approvalFeedback: feedback,
      rejectionFeedback: null,
    };

    await pool.query(
      `UPDATE complaints
       SET stage = 'Approved', history = $1::jsonb, wizard_data = $2::jsonb, updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(history), JSON.stringify(wizard), row.id]
    );

    const approveDetail = `${actor} approved ${row.id}. Feedback: ${feedback}. Sender can now Submit to register.`;
    const resolvedMeta = {
      resolution: 'APPROVED',
      resolvedAt: new Date().toISOString(),
      feedback,
      stage: 'Approved',
      lastEvent: 'APPROVED',
      canSubmit: true,
    };

    const { rows: adminInbox } = await pool.query(
      `SELECT DISTINCT user_id FROM notifications
       WHERE complaint_id = $1 AND type = 'approval_request'`,
      [row.id]
    );
    const adminTargets = adminInbox.length
      ? adminInbox.map((r) => r.user_id)
      : [req.user.id];

    for (const adminUserId of adminTargets) {
      await upsertComplaintNotification({
        userId: adminUserId,
        senderId: row.created_by,
        type: 'approval_request',
        title: `Approved · ${row.id}`,
        body: approveDetail,
        complaintId: row.id,
        markUnread: false,
        metaPatch: resolvedMeta,
        logEntry: {
          event: 'APPROVED',
          by: actor,
          detail: `Approved — ${feedback}`,
        },
      });
    }

    // Update sender thread card in place (no new notification)
    if (row.created_by) {
      await upsertComplaintNotification({
        userId: row.created_by,
        senderId: req.user.id,
        type: 'approval_sent',
        title: `Approved · ${row.id}`,
        body: `${approveDetail} Please Submit to register.`,
        complaintId: row.id,
        markUnread: true,
        metaPatch: {
          ...resolvedMeta,
          canSubmit: true,
        },
        logEntry: {
          event: 'APPROVED',
          by: actor,
          detail: `Approved — ${feedback}`,
        },
      });
    }

    await writeAuditLog({
      user: req.user,
      module: 'Approvals',
      action: 'Approved',
      detail: `${row.id}: ${feedback}`,
      meta: { complaintId: row.id, feedback },
    });

    await syncApprovalNotificationsFromComplaint(row.id);

    const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [row.id]);
    res.json({ complaint: rowToComplaint(full[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to approve' });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    if (!['ADMIN', 'QUALITY_HEAD'].includes(req.user.roleKey) && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Only admin can reject' });
    }
    const feedback = String(req.body?.feedback || '').trim();
    if (!feedback) return res.status(400).json({ error: 'Rejection feedback is required' });

    const { rows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    if (row.stage !== 'Pending Approval') {
      return res.status(400).json({ error: 'Complaint is not pending approval' });
    }

    const actor = req.user.name || req.user.email;
    const history = [
      ...asHistoryArray(row.history),
      historyEntry(`Rejected: ${feedback}`, actor),
    ];
    const wizard = {
      ...(row.wizard_data || {}),
      approvalStatus: 'REJECTED',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.user.id,
      rejectionFeedback: feedback,
      approvalFeedback: null,
    };

    await pool.query(
      `UPDATE complaints
       SET stage = 'Rejected', history = $1::jsonb, wizard_data = $2::jsonb, updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(history), JSON.stringify(wizard), row.id]
    );

    const rejectDetail = `${actor} rejected ${row.id}. Feedback: ${feedback}`;
    const resolvedMeta = {
      resolution: 'REJECTED',
      feedback,
      resolvedAt: new Date().toISOString(),
      stage: 'Rejected',
      lastEvent: 'REJECTED',
      badge: 'REJECTED',
      canApprove: false,
      canReject: false,
      canResend: true,
      canSubmit: false,
      waitingForResend: true,
    };

    // Update the SAME admin card in place (hidden until sender re-sends — no new row)
    const { rows: adminInbox } = await pool.query(
      `SELECT DISTINCT user_id FROM notifications
       WHERE complaint_id = $1 AND type = 'approval_request'`,
      [row.id]
    );
    const adminTargets = adminInbox.length
      ? adminInbox.map((r) => r.user_id)
      : [req.user.id];

    for (const adminUserId of adminTargets) {
      await upsertComplaintNotification({
        userId: adminUserId,
        senderId: row.created_by,
        type: 'approval_request',
        title: `Rejected · ${row.id}`,
        body: `${rejectDetail} Waiting for sender to update & resend.`,
        complaintId: row.id,
        markUnread: false,
        metaPatch: resolvedMeta,
        logEntry: {
          event: 'REJECTED',
          by: actor,
          detail: `Rejected — ${feedback}`,
        },
      });
    }

    // Update the SAME sender card in place (shows Update & resend)
    if (row.created_by) {
      await upsertComplaintNotification({
        userId: row.created_by,
        senderId: req.user.id,
        type: 'approval_sent',
        title: `Rejected · ${row.id}`,
        body: rejectDetail,
        complaintId: row.id,
        markUnread: true,
        metaPatch: {
          ...resolvedMeta,
          waitingForResend: false,
          canResend: true,
        },
        logEntry: {
          event: 'REJECTED',
          by: actor,
          detail: `Rejected — ${feedback}`,
        },
      });
    }

    await writeAuditLog({
      user: req.user,
      module: 'New Complaint',
      action: 'Rejected',
      detail: `${row.id}: ${feedback}`,
      meta: { complaintId: row.id, feedback },
    });

    await syncApprovalNotificationsFromComplaint(row.id);

    const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [row.id]);
    res.json({ complaint: rowToComplaint(full[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to reject' });
  }
});

/** Sender final Submit after admin approval — registers in DB + CSV + audit log */
router.post('/:id/submit', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];

    if (row.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the sender can submit this complaint' });
    }

    const stage = String(row.stage || '').trim();
    if (['Open', 'In Progress', 'Closed', 'Verified'].includes(stage)) {
      await syncApprovalNotificationsFromComplaint(row.id);
      const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [row.id]);
      return res.json({
        complaint: rowToComplaint(full[0]),
        alreadySubmitted: true,
        message: 'Complaint already submitted',
      });
    }

    if (stage !== 'Approved') {
      return res.status(400).json({
        error: `Cannot submit from stage "${stage || 'unknown'}". Admin must approve first.`,
      });
    }

    if (!row.root_cause || !(row.why_why && row.why_why.length) || !row.corrective_action || !row.preventive_action) {
      return res.status(400).json({ error: 'RCA, Why-Why, CA and PA must be complete before submit' });
    }

    const actor = req.user.name || req.user.email;
    const submittedAt = new Date().toISOString();
    const history = [
      ...asHistoryArray(row.history),
      historyEntry('Complaint submitted to register', actor),
    ];
    const wizard = {
      ...(row.wizard_data || {}),
      approvalStatus: 'SUBMITTED',
      submittedAt,
      submittedBy: req.user.id,
    };

    await pool.query(
      `UPDATE complaints
       SET stage = 'Open', history = $1::jsonb, wizard_data = $2::jsonb, updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(history), JSON.stringify(wizard), row.id]
    );

    let registerPath = null;
    try {
      registerPath = appendComplaintRegister({
        id: row.id,
        submitted_at: submittedAt,
        raised_date: row.raised_date,
        type: row.type,
        severity: row.severity,
        defect_category: row.defect_category,
        part_code: row.part_code,
        part: row.part,
        customer: row.customer,
        lot_qty: row.lot_qty,
        defect_qty: row.defect_qty,
        rejection_pct: row.rejection_pct,
        description: row.description,
        root_cause: row.root_cause,
        why_why: Array.isArray(row.why_why) ? row.why_why.join(' | ') : '',
        corrective_action: row.corrective_action,
        preventive_action: row.preventive_action,
        stage: 'Open',
        created_by: actor,
        approved_by: wizard.approvedBy || '',
      });
    } catch (csvErr) {
      console.error('complaint register csv append failed', csvErr);
    }

    await writeAuditLog({
      user: req.user,
      module: 'New Complaint',
      action: 'Submitted',
      detail: `${row.id} submitted to complaint register`,
      meta: { complaintId: row.id, registerPath },
    });

    await upsertComplaintNotification({
      userId: req.user.id,
      senderId: req.user.id,
      type: 'approval_sent',
      title: `Submitted · ${row.id}`,
      body: `${actor} submitted ${row.id} to the complaint register.`,
      complaintId: row.id,
      markUnread: false,
      metaPatch: {
        resolution: 'SUBMITTED',
        stage: 'Open',
        lastEvent: 'SUBMITTED',
        canSubmit: false,
      },
      logEntry: {
        event: 'SUBMITTED',
        by: actor,
        detail: 'Submitted to complaint register (DB + CSV)',
      },
    });

    const { rows: adminInbox } = await pool.query(
      `SELECT DISTINCT user_id FROM notifications
       WHERE complaint_id = $1 AND type = 'approval_request'`,
      [row.id]
    );
    for (const adminRow of adminInbox) {
      await upsertComplaintNotification({
        userId: adminRow.user_id,
        senderId: req.user.id,
        type: 'approval_request',
        title: `Submitted · ${row.id}`,
        body: `${actor} submitted ${row.id} to the complaint register.`,
        complaintId: row.id,
        markUnread: true,
        metaPatch: {
          resolution: 'SUBMITTED',
          stage: 'Open',
          lastEvent: 'SUBMITTED',
          canSubmit: false,
        },
        logEntry: {
          event: 'SUBMITTED',
          by: actor,
          detail: 'Submitted to complaint register (DB + CSV)',
        },
      });
    }

    await syncApprovalNotificationsFromComplaint(row.id);

    const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [row.id]);
    res.json({
      complaint: rowToComplaint(full[0]),
      registerPath,
      message: 'Complaint submitted to register',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to submit complaint' });
  }
});

router.post('/', async (req, res) => {
  if (req.user.roleKey === 'QUALITY_SUPPORT') {
    return res.status(403).json({ error: 'Quality Support cannot create complaints' });
  }
  const c = req.body;
  const desc = (c?.desc || '').trim() || (c?.type === 'Supplier' ? 'Supplier complaint (draft)' : '');
  if (!desc) return res.status(400).json({ error: 'Description is required' });

  const id = c.id || (await nextComplaintId());

  const history = c.history?.length
    ? c.history
    : [{ date: new Date().toLocaleString(), action: 'Complaint raised', by: req.user.email }];

  try {
    const { rows } = await pool.query(
      `INSERT INTO complaints
        (id, type, description, part, part_code, customer, defect_category, severity, process, stage,
         raised_date, root_cause, corrective_action, preventive_action, why_why, cft_team,
         lot_qty, defect_qty, rejection_pct,
         history, tasks, attachments, wizard_data, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [
        id,
        c.type || 'Complaint',
        desc,
        c.part || null,
        c.partCode || null,
        c.customer || null,
        c.defectCat || null,
        c.severity || 'Major',
        c.process || null,
        c.stage || 'Open',
        c.raisedDate || new Date().toISOString().slice(0, 10),
        c.rootCause || null,
        c.correctiveAction || null,
        c.preventiveAction || null,
        JSON.stringify(c.whyWhy || []),
        c.cftTeam || null,
        c.lotQty ?? null,
        c.defectQty ?? null,
        c.rejectionPct ?? null,
        JSON.stringify(history),
        JSON.stringify(c.tasks || []),
        JSON.stringify(c.attachments || []),
        JSON.stringify(c.wizardData || {}),
        c.assignedTo || req.user.id,
        req.user.id,
      ]
    );
    const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [rows[0].id]);
    const complaint = rowToComplaint(full[0]);
    await writeAuditLog({
      user: req.user,
      module: 'New Complaint',
      action: 'Complaint submitted',
      detail: `${complaint.id} · ${complaint.type} · ${complaint.severity}`,
      meta: {
        complaintId: complaint.id,
        type: complaint.type,
        severity: complaint.severity,
        defectCat: complaint.defectCat,
        raisedDate: complaint.raisedDate,
      },
    });
    res.status(201).json({ complaint });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

router.patch('/:id', async (req, res) => {
  const fields = req.body || {};
  if (fields.stage === 'Closed' && !['ADMIN', 'QUALITY_HEAD', 'MANAGEMENT'].includes(req.user.roleKey)) {
    return res.status(403).json({ error: 'Only Admin or Quality Head can close CAPA cases' });
  }
  const colMap = {
    desc: 'description',
    part: 'part',
    partCode: 'part_code',
    customer: 'customer',
    defectCat: 'defect_category',
    severity: 'severity',
    process: 'process',
    stage: 'stage',
    rootCause: 'root_cause',
    correctiveAction: 'corrective_action',
    preventiveAction: 'preventive_action',
    whyWhy: 'why_why',
    cftTeam: 'cft_team',
    lotQty: 'lot_qty',
    defectQty: 'defect_qty',
    rejectionPct: 'rejection_pct',
    history: 'history',
    tasks: 'tasks',
    attachments: 'attachments',
    wizardData: 'wizard_data',
    assignedTo: 'assigned_to',
    type: 'type',
  };

  // POC: role-based stage gates disabled for now

  const sets = [];
  const params = [];
  let i = 1;
  for (const [key, col] of Object.entries(colMap)) {
    if (fields[key] !== undefined) {
      const isJson = ['whyWhy', 'history', 'tasks', 'attachments', 'wizardData'].includes(key);
      sets.push(`${col} = $${i}`);
      params.push(isJson ? JSON.stringify(fields[key]) : fields[key]);
      i++;
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  sets.push('updated_at = now()');
  params.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE complaints SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });

  const { rows: full } = await pool.query(`${LIST_SQL} WHERE c.id = $1`, [req.params.id]);
  res.json({ complaint: rowToComplaint(full[0]) });
});

router.delete('/:id', async (req, res) => {
  if (!canDeleteCapa(req.user.roleKey) && !['MANAGEMENT', 'QUALITY_HEAD'].includes(req.user.roleKey)) {
    return res.status(403).json({ error: 'Not allowed to delete complaints' });
  }
  await pool.query('DELETE FROM complaints WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
