const express = require('express');
const multer = require('multer');
const { requireAuth, requireRoles } = require('../middleware/auth');
const {
  loadComplaintMasters,
  saveComplaintMasters,
  parseMasterSheet,
} = require('../services/complaintMasters');
const { writeAuditLog } = require('../services/auditLog');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.use(requireAuth);

router.get('/', async (_req, res) => {
  try {
    const masters = await loadComplaintMasters();
    try {
      const { readCases, uniqueDefectCategories, hasActiveDataset } = require('../services/historicDataset');
      if (hasActiveDataset()) {
        const fromData = uniqueDefectCategories(readCases());
        masters.defects = Array.from(new Set([...(fromData || []), ...(masters.defects || [])])).sort((a, b) =>
          a.localeCompare(b)
        );
      }
    } catch {
      /* optional */
    }
    res.json({ masters });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load complaint masters' });
  }
});

router.put('/', requireRoles('ADMIN'), async (req, res) => {
  try {
    const masters = await saveComplaintMasters(req.body?.masters || req.body || {});
    await writeAuditLog({
      user: req.user,
      module: 'Complaint Masters',
      action: 'Masters updated',
      detail: `Types ${masters.types.length} · Severities ${masters.severities.length} · Defects ${masters.defects.length}`,
      meta: {
        types: masters.types.length,
        severities: masters.severities.length,
        defects: masters.defects.length,
      },
    });
    res.json({ masters });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save complaint masters' });
  }
});

router.post('/import', requireRoles('ADMIN'), upload.single('file'), async (req, res) => {
  try {
    let text = String(req.body?.text || '').trim();
    if (req.file) {
      text = req.file.buffer.toString('utf8');
    }
    if (!text) return res.status(400).json({ error: 'Upload a CSV/Excel file or paste sheet data' });

    const masters = await saveComplaintMasters(parseMasterSheet(text));
    await writeAuditLog({
      user: req.user,
      module: 'Complaint Masters',
      action: 'Excel/CSV import',
      detail: `Imported ${masters.types.length} types, ${masters.severities.length} severities, ${masters.defects.length} defects`,
      meta: { source: req.file?.originalname || 'paste' },
    });
    res.json({ masters });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Failed to import masters' });
  }
});

module.exports = router;
