const fs = require('fs');
const path = require('path');

const REGISTER_DIR = path.join(__dirname, '..', '..', 'data');
const REGISTER_CSV = path.join(REGISTER_DIR, 'complaint-register.csv');

const HEADERS = [
  'id',
  'submitted_at',
  'raised_date',
  'type',
  'severity',
  'defect_category',
  'part_code',
  'part',
  'customer',
  'lot_qty',
  'defect_qty',
  'rejection_pct',
  'description',
  'root_cause',
  'why_why',
  'corrective_action',
  'preventive_action',
  'stage',
  'created_by',
  'approved_by',
];

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function ensureRegisterFile() {
  if (!fs.existsSync(REGISTER_DIR)) fs.mkdirSync(REGISTER_DIR, { recursive: true });
  if (!fs.existsSync(REGISTER_CSV)) {
    fs.writeFileSync(REGISTER_CSV, `${HEADERS.join(',')}\n`, 'utf8');
  }
}

/** Append a submitted complaint row to the Excel-friendly CSV register. */
function appendComplaintRegister(row) {
  ensureRegisterFile();
  const line = HEADERS.map((key) => csvEscape(row[key])).join(',');
  fs.appendFileSync(REGISTER_CSV, `${line}\n`, 'utf8');
  return REGISTER_CSV;
}

module.exports = {
  appendComplaintRegister,
  REGISTER_CSV,
};
