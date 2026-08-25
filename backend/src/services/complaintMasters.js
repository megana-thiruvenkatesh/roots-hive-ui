const pool = require('../db/pool');

const SETTINGS_KEY = 'complaint_masters';

const DEFAULT_MASTERS = {
  types: ['Internal', 'Supplier'],
  severities: ['Critical', 'Major', 'Minor', 'Observation'],
  defects: [
    'Leakage',
    'Porosity',
    'Crack',
    'Dimensional Deviation',
    'Surface Finish',
    'Shrinkage',
    'Machining Issue',
    'Material Defect',
    'Cold Shut',
    'Contamination',
  ],
};

function uniqueList(values) {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  });
  return out;
}

function normalizeMasters(raw = {}) {
  return {
    types: uniqueList(raw.types?.length ? raw.types : DEFAULT_MASTERS.types),
    severities: uniqueList(raw.severities?.length ? raw.severities : DEFAULT_MASTERS.severities),
    defects: uniqueList(raw.defects?.length ? raw.defects : DEFAULT_MASTERS.defects),
  };
}

async function loadComplaintMasters() {
  const { rows } = await pool.query('SELECT value FROM app_settings WHERE key = $1', [SETTINGS_KEY]);
  return normalizeMasters(rows[0]?.value || DEFAULT_MASTERS);
}

async function saveComplaintMasters(masters) {
  const value = normalizeMasters(masters);
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(value)]
  );
  return value;
}

function splitRow(line) {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(',')) {
    return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, '').trim());
  }
  return [line];
}

function parseMasterSheet(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error('File is empty');
  }

  const headerCells = splitRow(lines[0]).map((cell) => cell.trim().toLowerCase());
  const typeIdx = headerCells.findIndex((cell) => cell === 'type' || cell === 'types');
  const severityIdx = headerCells.findIndex((cell) => cell === 'severity' || cell === 'severities');
  const defectIdx = headerCells.findIndex(
    (cell) => cell === 'defect' || cell === 'defects' || cell === 'defect / symptom' || cell === 'symptom'
  );

  if (typeIdx === -1 && severityIdx === -1 && defectIdx === -1) {
    throw new Error('First row must include Type, Severity, and Defect column headers');
  }

  const types = [];
  const severities = [];
  const defects = [];

  lines.slice(1).forEach((line) => {
    const cells = splitRow(line);
    if (typeIdx >= 0 && cells[typeIdx]) types.push(cells[typeIdx]);
    if (severityIdx >= 0 && cells[severityIdx]) severities.push(cells[severityIdx]);
    if (defectIdx >= 0 && cells[defectIdx]) defects.push(cells[defectIdx]);
  });

  return normalizeMasters({ types, severities, defects });
}

module.exports = {
  DEFAULT_MASTERS,
  loadComplaintMasters,
  saveComplaintMasters,
  parseMasterSheet,
};
