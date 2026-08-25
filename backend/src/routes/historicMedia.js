const path = require('path');
const fs = require('fs');
const express = require('express');

const router = express.Router();

const DEFAULT_ROOT = path.join(__dirname, '../../uploads/historic');
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

function mediaRoots() {
  const configured = String(process.env.HISTORIC_MEDIA_ROOT || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  const roots = [...configured, path.resolve(DEFAULT_ROOT), path.resolve(UPLOADS_ROOT)];
  return [...new Set(roots)];
}

function isInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(resolvedRoot + path.sep)
  );
}

function resolveMediaPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  let cleaned = rawPath.trim().replace(/^file:\/\//i, '');
  if (!cleaned) return null;

  // Allow /uploads/... URLs already exposed by static middleware.
  if (cleaned.startsWith('/uploads/')) {
    const fromUploads = path.resolve(UPLOADS_ROOT, cleaned.slice('/uploads/'.length));
    if (isInside(UPLOADS_ROOT, fromUploads) && fs.existsSync(fromUploads)) return fromUploads;
  }

  const candidates = [];
  if (path.isAbsolute(cleaned)) {
    candidates.push(path.resolve(cleaned));
  } else {
    cleaned = cleaned.replace(/^[/\\]+/, '');
    for (const root of mediaRoots()) {
      candidates.push(path.resolve(root, cleaned));
      // Common DB shape: historic/<caseId>/file.jpg under uploads root
      candidates.push(path.resolve(UPLOADS_ROOT, cleaned));
    }
  }

  for (const candidate of candidates) {
    for (const root of mediaRoots()) {
      if (isInside(root, candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }
  return null;
}

// GET /api/historic-media?path=<stored path from DB>
router.get('/', (req, res) => {
  try {
    const stored = req.query.path;
    const filePath = resolveMediaPath(stored);
    if (!filePath) return res.status(404).json({ error: 'Image not found' });
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load image' });
  }
});

module.exports = router;
