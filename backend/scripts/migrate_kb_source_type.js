require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(
    path.join(__dirname, '../../database/migrations/005_kb_source_type.sql'),
    'utf8'
  );
  await pool.query(sql);

  const docs = [
    [
      'Internal Leakage SOP',
      'Internal: For assembly leakage — quarantine, verify O-ring groove, pressure retest, update CP.',
      'Internal',
    ],
    [
      'Supplier Fitment SQPR Guide',
      'Supplier: For M6 hole offset / fitment — raise SQPR, containment, why-why on occurrence vs detection, update supplier CP.',
      'Supplier',
    ],
  ];

  for (const [name, content, sourceType] of docs) {
    await pool.query(
      `INSERT INTO kb_documents (name, content, source_type)
       SELECT $1::text, $2::text, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM kb_documents WHERE name = $1::text)`,
      [name, content, sourceType]
    );
  }

  // Tag existing dimensional SOP as Internal if still General
  await pool.query(
    `UPDATE kb_documents SET source_type = 'Internal'
     WHERE name = 'Dimensional Tolerance SOP' AND source_type = 'General'`
  );

  console.log('kb migration+seed ok');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
