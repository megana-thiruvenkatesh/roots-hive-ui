const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { ensureKbMediaSchema } = require('../services/kbMedia');
const { writeAuditLog } = require('../services/auditLog');

const router = express.Router();
router.use(requireAuth);

const uploadDir = path.join(__dirname, '../../uploads');
const kbDir = path.join(uploadDir, 'kb');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(kbDir)) fs.mkdirSync(kbDir, { recursive: true });

function diskStorage(dest) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  });
}

const complaintUpload = multer({
  storage: diskStorage(uploadDir),
  limits: { fileSize: 40 * 1024 * 1024 },
});

const kbUpload = multer({
  storage: diskStorage(kbDir),
  limits: { fileSize: 40 * 1024 * 1024 },
});

const TEXT_LIKE = /\.(txt|md|csv|json|log|tsv|xml|html?|rtf)$/i;

function extractContent(file) {
  const mime = file.mimetype || '';
  if (TEXT_LIKE.test(file.originalname) || mime.startsWith('text/') || mime.includes('json') || mime.includes('csv')) {
    try {
      return fs.readFileSync(file.path, 'utf8');
    } catch {
      return '';
    }
  }
  return `[Binary file stored: ${file.originalname} | type: ${mime || 'unknown'} | size: ${file.size} bytes]`;
}

function estimateRecords(content, file) {
  if (/\.csv$/i.test(file.originalname) && content && !content.startsWith('[Binary')) {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    return Math.max(0, lines.length - 1);
  }
  return 1;
}

// POST /api/uploads/complaint/:id
router.post('/complaint/:id', complaintUpload.array('files', 10), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT attachments, history FROM complaints WHERE id = $1', [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Complaint not found' });

    const existing = rows[0].attachments || [];
    const added = (req.files || []).map((f) => ({
      name: f.originalname,
      filename: f.filename,
      url: `/uploads/${f.filename}`,
      size: f.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.email,
    }));

    const attachments = [...existing, ...added];
    const history = [
      ...(rows[0].history || []),
      {
        date: new Date().toLocaleString(),
        action: `Uploaded ${added.length} file(s): ${added.map((a) => a.name).join(', ')}`,
        by: req.user.email,
      },
    ];

    await pool.query(
      `UPDATE complaints
       SET attachments = $1::jsonb, history = $2::jsonb, updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(attachments), JSON.stringify(history), req.params.id]
    );

    res.status(201).json({ attachments, added });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/uploads/kb — any document format
router.post('/kb', kbUpload.single('file'), async (req, res) => {
  try {
    await ensureKbMediaSchema();
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const content = extractContent(req.file);
    const fileUrl = `/uploads/kb/${req.file.filename}`;
    const recordCount = estimateRecords(content, req.file);

    const { rows } = await pool.query(
      `INSERT INTO kb_documents
         (name, content, source_type, uploaded_by, file_path, file_url, mime_type, file_size, original_name, record_count, status)
       VALUES ($1,$2,'General',$3,$4,$5,$6,$7,$8,$9,'ACTIVE')
       RETURNING id`,
      [
        req.file.originalname,
        content,
        req.user.id,
        req.file.path,
        fileUrl,
        req.file.mimetype || null,
        req.file.size || 0,
        req.file.originalname,
        recordCount,
      ]
    );

    await writeAuditLog({
      user: req.user,
      module: 'Knowledge Base',
      action: 'Upload Document',
      detail: req.file.originalname,
      meta: { documentId: rows[0].id, mimeType: req.file.mimetype, size: req.file.size },
    });

    const { rows: named } = await pool.query(
      `SELECT d.id, d.name, d.created_at AS "createdAt", d.file_url AS "fileUrl",
              d.mime_type AS "mimeType", d.file_size AS "fileSize", d.original_name AS "originalName",
              d.record_count AS "recordCount", d.status, d.source_type AS "sourceType",
              left(d.content, 200) AS preview,
              u.name AS "uploadedByName", u.email AS "uploadedByEmail", d.uploaded_by AS "uploadedBy"
       FROM kb_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({ document: { ...named[0], kind: 'document' } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'KB upload failed' });
  }
});

module.exports = router;
