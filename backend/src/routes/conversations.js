const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows: convs } = await pool.query(
    'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.user.id]
  );
  const ids = convs.map((c) => c.id);
  let msgs = [];
  if (ids.length) {
    const result = await pool.query(
      `SELECT * FROM messages WHERE conversation_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
      [ids]
    );
    msgs = result.rows;
  }
  const byConv = {};
  msgs.forEach((m) => {
    (byConv[m.conversation_id] = byConv[m.conversation_id] || []).push({
      id: m.id,
      role: m.role,
      text: m.text,
      meta: m.meta,
      createdAt: m.created_at,
    });
  });
  res.json({
    conversations: convs.map((c) => ({
      id: c.id,
      title: c.title,
      messages: byConv[c.id] || [],
    })),
  });
});

router.post('/', async (req, res) => {
  const { rows } = await pool.query(
    'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
    [req.user.id, req.body?.title || 'New chat']
  );
  res.status(201).json({ conversation: { id: rows[0].id, title: rows[0].title, messages: [] } });
});

router.post('/:id/messages', async (req, res) => {
  const { role, text, meta, title } = req.body || {};
  if (!role || !text) return res.status(400).json({ error: 'role and text are required' });

  const { rows } = await pool.query(
    'INSERT INTO messages (conversation_id, role, text, meta) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, role, text, meta ? JSON.stringify(meta) : null]
  );
  await pool.query(
    'UPDATE conversations SET updated_at = now(), title = COALESCE($2, title) WHERE id = $1 AND user_id = $3',
    [req.params.id, title || null, req.user.id]
  );
  res.status(201).json({ message: rows[0] });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM conversations WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  res.status(204).end();
});

router.delete('/', async (req, res) => {
  await pool.query('DELETE FROM conversations WHERE user_id = $1', [req.user.id]);
  res.status(204).end();
});

module.exports = router;
