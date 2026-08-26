require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/db/pool');

async function main() {
  const value = {
    types: ['Internal', 'Supplier'],
    severities: ['Critical', 'Major', 'Minor', 'Observation'],
    defects: [],
  };
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('complaint_masters', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(value)]
  );
  const counts = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM complaints) AS complaints,
       (SELECT COUNT(*)::int FROM kb_documents) AS kb,
       (SELECT COUNT(*)::int FROM notifications) AS notifications`
  );
  console.log('masters reset', value);
  console.log('counts', counts.rows[0]);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
