/**
 * Wipe runtime demo/seed data so the app starts empty.
 * Keeps users/roles. Keeps active historic Excel dataset under data/historic/.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function count(table) {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    return rows[0].c;
  } catch {
    return null;
  }
}

async function wipe(sql, label) {
  try {
    const r = await pool.query(sql);
    console.log(`OK  ${label}${r.rowCount != null ? ` (${r.rowCount})` : ''}`);
  } catch (e) {
    console.log(`SKIP ${label}: ${e.message}`);
  }
}

async function main() {
  console.log('Before:');
  for (const t of [
    'complaints',
    'kb_documents',
    'kb_connectors',
    'notifications',
    'audit_logs',
    'messages',
    'conversations',
    'complaint_types',
    'defect_categories',
    'severities',
    'processes',
  ]) {
    const c = await count(t);
    if (c !== null) console.log(`  ${t}: ${c}`);
  }

  // Child / dependent data first where needed
  await wipe('DELETE FROM messages', 'messages');
  await wipe('DELETE FROM conversations', 'conversations');
  await wipe('DELETE FROM notifications', 'notifications');
  await wipe('DELETE FROM audit_logs', 'audit_logs');
  await wipe('DELETE FROM complaints', 'complaints');
  await wipe('DELETE FROM kb_documents', 'kb_documents');
  await wipe('DELETE FROM kb_connectors', 'kb_connectors');

  // Complaint master dropdown seed rows (types/defects/etc.) — empty fresh
  await wipe('DELETE FROM defect_categories', 'defect_categories');
  await wipe('DELETE FROM complaint_types', 'complaint_types');
  await wipe('DELETE FROM severities', 'severities');
  await wipe('DELETE FROM processes', 'processes');
  await wipe('DELETE FROM complaint_masters', 'complaint_masters');

  console.log('\nAfter:');
  for (const t of ['complaints', 'kb_documents', 'kb_connectors', 'notifications', 'audit_logs']) {
    const c = await count(t);
    if (c !== null) console.log(`  ${t}: ${c}`);
  }

  await pool.end();
  console.log('\nFresh reset done. Users kept. Historic Excel under data/historic/ unchanged.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
