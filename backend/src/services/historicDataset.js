const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { loadComplaintMasters, saveComplaintMasters } = require('./complaintMasters');

const HISTORIC_DIR = path.join(__dirname, '../../data/historic');
const CASES_FILE = path.join(HISTORIC_DIR, 'cases.json');
const META_FILE = path.join(HISTORIC_DIR, 'meta.json');

const COLUMN_ALIASES = {
  ims_refno: ['ims_refno', 'refno', 'ref_no', 'id', 'ims_ref'],
  item_code: ['item_code', 'itemcode', 'ims_itemcode', 'part_code', 'partcode'],
  item_name: ['item_name', 'itemname', 'ims_itemname', 'part_name', 'part'],
  party_code: ['party_code', 'partycode', 'ims_party', 'customer', 'supplier', 'party'],
  problem_statement: [
    'problem_statement',
    'problemstatement',
    'description',
    'desc',
    'ims_problemstatement',
    'symptom',
  ],
  lot_qty: ['lot_qty', 'lotqty', 'ims_lotqty', 'lot_quantity'],
  defect_qty: ['defect_qty', 'defectqty', 'ims_defectqty', 'defect_quantity'],
  date_of_issue: ['date_of_issue', 'dateofissue', 'ims_dateofissue', 'issue_date', 'record_date', 'date'],
  defect_category: ['defect_category', 'defectcategory', 'defect_cat', 'category', 'defect', 'symptom'],
  root_cause: ['root_cause', 'rootcause', 'rca', 'ims_rootcause'],
  why_why: ['why_why', 'whywhy', 'why_why_analysis', 'ims_why', 'why'],
  why_1: ['why_1', 'why1'],
  why_2: ['why_2', 'why2'],
  why_3: ['why_3', 'why3'],
  why_4: ['why_4', 'why4'],
  why_5: ['why_5', 'why5'],
  corrective_action: [
    'corrective_action',
    'correctiveaction',
    'ca',
    'ims_correctiveaction',
  ],
  preventive_action: [
    'preventive_action',
    'preventiveaction',
    'pa',
    'ims_preventiveaction',
    'ims_onsiteverification',
  ],
  severity: ['severity'],
  process: ['process', 'operation', 'process_name'],
};

function ensureDir() {
  if (!fs.existsSync(HISTORIC_DIR)) fs.mkdirSync(HISTORIC_DIR, { recursive: true });
}

function normKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function pick(row, field) {
  const aliases = COLUMN_ALIASES[field] || [field];
  for (const alias of aliases) {
    if (row[alias] != null && String(row[alias]).trim() !== '') return row[alias];
  }
  return '';
}

function toIsoDate(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function sheetToObjects(buffer, originalName = '') {
  const lower = String(originalName || '').toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    const text = buffer.toString('utf8');
    const wb = XLSX.read(text, { type: 'string', raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function normalizeRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    out[normKey(k)] = v;
  }
  return out;
}

function parseWhyWhy(row) {
  const fromCols = [1, 2, 3, 4, 5]
    .map((n) => String(pick(row, `why_${n}`) || '').trim())
    .filter(Boolean);
  if (fromCols.length) return fromCols;

  const raw = String(pick(row, 'why_why') || '').trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n|\||;/)
    .map((s) => s.replace(/^why\s*\d+\s*[:.\-)]\s*/i, '').trim())
    .filter(Boolean);
}

function rowToCase(raw, index) {
  const row = normalizeRowKeys(raw);
  const ref = pick(row, 'ims_refno') || index + 1;
  const itemCode = String(pick(row, 'item_code') || '').trim();
  const itemName = String(pick(row, 'item_name') || '').trim();
  const party = String(pick(row, 'party_code') || '').trim();
  const problem = String(pick(row, 'problem_statement') || '').trim();
  const lotQty = pick(row, 'lot_qty');
  const defectQty = pick(row, 'defect_qty');
  const issueDate = toIsoDate(pick(row, 'date_of_issue'));
  const defectCat = String(pick(row, 'defect_category') || '').trim();
  const rootCause = String(pick(row, 'root_cause') || '').trim();
  const whyWhy = parseWhyWhy(row);
  const correctiveAction = String(pick(row, 'corrective_action') || '').trim();
  const preventiveAction = String(pick(row, 'preventive_action') || '').trim();
  const severity = String(pick(row, 'severity') || '').trim();
  const process = String(pick(row, 'process') || '').trim();
  const whyJoined = whyWhy.join('\n');

  const id = `PROD-S/${ref}`;
  return {
    id,
    symptom: defectCat || itemName || 'Defect',
    description: problem,
    part: itemName || itemCode,
    partCode: itemCode,
    customer: party,
    defectCat,
    lotQty,
    defectQty,
    recordDate: issueDate,
    rootCause,
    whyWhy,
    correctiveAction,
    preventiveAction,
    severity,
    process,
    source: 'dataset',
    sourceType: 'Supplier',
    chunk: {
      header: {
        IMS_PREFIX: 'PROD-S',
        IMS_REFNO: ref,
        IMS_TYPEID: 2,
        IMS_SUBTYPEID: 1,
      },
      detail: {
        SPN_Number: id,
        IMS_PARTY: party,
        IMS_ITEMCODE: itemCode,
        IMS_ITEMNAME: itemName,
        IMS_DATEOFISSUE: issueDate,
        IMS_LOTQTY: lotQty,
        IMS_DEFECTQTY: defectQty,
        IMS_DEFECTCATEGORY: defectCat,
        IMS_SEVERITY: severity,
        IMS_PROCESS: process,
      },
      step2: {
        IMS_PROBLEMSTATEMENT: problem,
      },
      rca: {
        IMS_WHY: whyJoined,
        IMS_ROOTCAUSE: rootCause,
      },
      ca: {
        IMS_CORRECTIVEACTION: correctiveAction,
      },
      pa: {
        IMS_ONSITEVERIFICATION: preventiveAction,
        IMS_PREVENTIVEACTION: preventiveAction,
      },
    },
  };
}

function parseHistoricFile(buffer, originalName) {
  const rows = sheetToObjects(buffer, originalName);
  if (!rows.length) throw new Error('No data rows found in file');

  const cases = rows
    .map((row, index) => rowToCase(row, index))
    .filter((c) => c.description || c.partCode || c.defectCat || c.part);

  if (!cases.length) {
    throw new Error(
      'Could not map rows. Expected columns like item_code, item_name, problem_statement, defect_category.'
    );
  }
  return cases;
}

function readCases() {
  ensureDir();
  if (!fs.existsSync(CASES_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function readMeta() {
  ensureDir();
  if (!fs.existsSync(META_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function uniqueDefectCategories(cases) {
  const set = new Set();
  for (const c of cases) {
    const v = String(c.defectCat || c.symptom || '').trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

async function syncDefectMasters(categories) {
  try {
    const masters = await loadComplaintMasters();
    const merged = Array.from(new Set([...(masters.defects || []), ...categories])).sort((a, b) =>
      a.localeCompare(b)
    );
    await saveComplaintMasters({
      types: masters.types?.length ? masters.types : ['Internal', 'Supplier'],
      severities: masters.severities?.length
        ? masters.severities
        : ['Critical', 'Major', 'Minor', 'Observation'],
      defects: merged.length ? merged : masters.defects,
    });
  } catch (err) {
    console.warn('defect master sync skipped', err.message);
  }
}

async function saveHistoricDataset({ cases, originalName, uploadedBy }) {
  ensureDir();
  fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2), 'utf8');
  const categories = uniqueDefectCategories(cases);
  const meta = {
    originalName: originalName || 'historic-dataset',
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy || null,
    recordCount: cases.length,
    defectCategories: categories,
  };
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
  await syncDefectMasters(categories);
  return meta;
}

async function importHistoricBuffer(buffer, originalName, uploadedBy) {
  const cases = parseHistoricFile(buffer, originalName);
  const meta = await saveHistoricDataset({ cases, originalName, uploadedBy });
  return { cases, meta };
}

function hasActiveDataset() {
  return fs.existsSync(CASES_FILE) && readCases().length > 0;
}

module.exports = {
  HISTORIC_DIR,
  CASES_FILE,
  parseHistoricFile,
  readCases,
  readMeta,
  uniqueDefectCategories,
  saveHistoricDataset,
  importHistoricBuffer,
  hasActiveDataset,
};
