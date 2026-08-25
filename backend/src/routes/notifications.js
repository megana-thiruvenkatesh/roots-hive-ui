const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const {
  ensureNotificationsTable,
  syncApprovalNotificationsFromComplaint,
  approvalStateFromStage,
} = require('../services/notifications');

const router = express.Router();
router.use(requireAuth);

function mapRow(row) {
  const complaintStage = row.complaint_stage || null;
  const wizard = row.complaint_wizard || {};
  const live = complaintStage
    ? approvalStateFromStage(complaintStage, wizard)
    : null;
  const meta = { ...(row.meta || {}) };
  const isRequest = row.type === 'approval_request';
  const isSent = row.type === 'approval_sent';
  if (live) {
    meta.resolution = live.resolution;
    meta.stage = live.stage;
    meta.badge = live.badge;
    meta.canApprove = live.canApprove && isRequest;
    meta.canReject = live.canReject && isRequest;
    meta.canResend = live.canResend && isSent;
    meta.canSubmit = live.canSubmit && isSent;
    if (live.feedback) meta.feedback = live.feedback;
  }

  return {
    id: row.id,
    userId: row.user_id,
    senderId: row.sender_id,
    senderName: row.sender_name || null,
    senderEmail: row.sender_email || null,
    type: row.type,
    title: row.title,
    body: row.body,
    complaintId: row.complaint_id,
    complaintStage,
    complaintCreatedBy: row.complaint_created_by || null,
    meta,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function mapRowSimple(row) {
  return {
    id: row.id,
    userId: row.user_id,
    senderId: row.sender_id,
    senderName: row.sender_name || null,
    senderEmail: row.sender_email || null,
    type: row.type,
    title: row.title,
    body: row.body,
    complaintId: row.complaint_id,
    complaintStage: row.complaint_stage || null,
    complaintCreatedBy: row.complaint_created_by || null,
    meta: row.meta || {},
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

router.get('/', async (req, res) => {
  try {
    await ensureNotificationsTable();

    try {
      await pool.query(
        `DELETE FROM notifications
         WHERE user_id = $1
           AND type IN ('approval_approved', 'approval_rejected')`,
        [req.user.id]
      );
      await pool.query(
        `DELETE FROM notifications a
         USING notifications b
         WHERE a.user_id = $1
           AND b.user_id = $1
           AND a.complaint_id IS NOT NULL
           AND a.complaint_id = b.complaint_id
           AND a.type = b.type
           AND a.type IN ('approval_sent', 'approval_request')
           AND a.created_at > b.created_at`,
        [req.user.id]
      );
      // Do NOT delete rejected admin cards — keep the same row; only hide in the query
      // until sender re-sends (status stays on one notification forever).
    } catch (cleanupErr) {
      console.error('notifications cleanup', cleanupErr);
    }

    // One card per complaint per type — statuses update on that same row
    const listSql = `
      SELECT n.*,
             s.name AS sender_name,
             s.email AS sender_email,
             c.stage AS complaint_stage,
             c.wizard_data AS complaint_wizard,
             c.created_by AS complaint_created_by
      FROM notifications n
      LEFT JOIN users s ON s.id = n.sender_id
      LEFT JOIN complaints c ON c.id = n.complaint_id
      WHERE n.user_id = $1
        AND n.type IN ('approval_request', 'approval_sent')
        AND NOT (
          n.type = 'approval_request'
          AND (
            COALESCE(c.stage, '') IN ('Rejected', 'Draft')
            OR COALESCE(n.meta->>'waitingForResend', 'false') = 'true'
          )
        )
      ORDER BY COALESCE(n.updated_at, n.created_at) DESC
      LIMIT 200`;

    const { rows } = await pool.query(listSql, [req.user.id]);

    try {
      const seenComplaints = new Set();
      for (const row of rows) {
        if (!row.complaint_id || !row.complaint_stage) continue;
        if (seenComplaints.has(row.complaint_id)) continue;
        seenComplaints.add(row.complaint_id);
        const meta = row.meta || {};
        const live = approvalStateFromStage(row.complaint_stage, row.complaint_wizard || {});
        const drifted =
          meta.badge !== live.badge ||
          meta.stage !== live.stage ||
          (meta.resolution || null) !== (live.resolution || null);
        if (drifted) {
          await syncApprovalNotificationsFromComplaint(row.complaint_id);
        }
      }
    } catch (healErr) {
      console.error('notifications heal', healErr);
    }

    const { rows: fresh } = await pool.query(listSql, [req.user.id]);
    const mapped = fresh.map(mapRow);
    const unread = mapped.filter((row) => !row.readAt).length;
    res.json({ notifications: mapped, unread });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load notifications' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    await ensureNotificationsTable();
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM notifications n
       LEFT JOIN complaints c ON c.id = n.complaint_id
       WHERE n.user_id = $1
         AND n.read_at IS NULL
         AND n.type IN ('approval_request', 'approval_sent')
         AND NOT (
           n.type = 'approval_request'
           AND (
             COALESCE(c.stage, '') IN ('Rejected', 'Draft')
             OR COALESCE(n.meta->>'waitingForResend', 'false') = 'true'
           )
         )`,
      [req.user.id]
    );
    res.json({ unread: rows[0]?.n || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await ensureNotificationsTable();
    const { rows } = await pool.query(
      `UPDATE notifications n
       SET read_at = COALESCE(n.read_at, now())
       WHERE n.id = $1 AND n.user_id = $2
       RETURNING n.*`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ notification: mapRowSimple(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update notification' });
  }
});

router.post('/mark-all-read', async (req, res) => {
  try {
    await ensureNotificationsTable();
    await pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

module.exports = router;
