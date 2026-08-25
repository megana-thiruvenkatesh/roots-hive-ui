require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const DEMO_USERS = [
  {
    name: 'Vivin',
    email: 'vivin@sfwtechnologies.com',
    password: 'Admin@123',
    dept: 'IT Security',
    role_key: 'ADMIN',
    role_label: 'Admin',
    is_admin: true,
  },
  {
    name: 'Ram',
    email: 'ram@sfwtechnologies.com',
    password: 'Ram123!',
    dept: 'Quality',
    role_key: 'QUALITY_HEAD',
    role_label: 'Quality Head',
    is_admin: false,
  },
  {
    name: 'Stanly Raj',
    email: 'stanly.raj@sfwtechnologies.com',
    password: 'Stanly@123',
    dept: 'Quality',
    role_key: 'QUALITY_MANAGER',
    role_label: 'Quality Manager',
    is_admin: false,
  },
  {
    name: 'Meganamani T',
    email: 'meganamani.t@sfwtechnologies.com',
    password: 'Megs123!',
    dept: 'Quality',
    role_key: 'QUALITY_EMPLOYEE',
    role_label: 'Quality Employee',
    is_admin: false,
  },
  {
    name: 'Megana',
    email: 'meganamanit@gmail.com',
    password: 'Support@123',
    dept: 'Quality Support',
    role_key: 'QUALITY_SUPPORT',
    role_label: 'Quality Support Engineer',
    is_admin: false,
  },
];

const SAMPLE_COMPLAINTS = [
  {
    id: 'CAPA-2026-0001',
    description: 'Dimensional deviation on shaft OD after machining',
    part: 'SHAFT-220',
    customer: 'AutoTier-A',
    defect_category: 'Dimensional',
    severity: 'Major',
    process: 'CNC Turning',
    stage: 'RCA',
  },
  {
    id: 'CAPA-2026-0002',
    description: 'Surface scratch on painted housing',
    part: 'HSG-110',
    customer: 'OEM-North',
    defect_category: 'Surface Finish',
    severity: 'Minor',
    process: 'Paint Line',
    stage: 'Open',
  },
  {
    id: 'CAPA-2026-0003',
    description: 'Leakage observed during pressure test',
    part: 'VALVE-45',
    customer: 'FluidSys',
    defect_category: 'Leakage',
    severity: 'Critical',
    process: 'Assembly',
    stage: 'CAPA',
  },
  {
    id: 'CAPA-2026-0004',
    description: 'Hairline crack near weld zone',
    part: 'BRKT-88',
    customer: 'HeavyInd',
    defect_category: 'Crack',
    severity: 'Critical',
    process: 'Welding',
    stage: 'Verification',
  },
  {
    id: 'CAPA-2026-0005',
    description: 'Porosity in casting — rejected at incoming QC',
    part: 'CAST-301',
    customer: 'Internal',
    defect_category: 'Porosity',
    severity: 'Major',
    process: 'Incoming QC',
    stage: 'Closed',
  },
];

async function seed() {
  const userIds = {};
  const emails = DEMO_USERS.map((u) => u.email.toLowerCase());

  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, dept, role_key, role_label, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         dept = EXCLUDED.dept,
         role_key = EXCLUDED.role_key,
         role_label = EXCLUDED.role_label,
         is_admin = EXCLUDED.is_admin,
         updated_at = now()
       RETURNING id, email, role_key`,
      [u.name, u.email.toLowerCase(), hash, u.dept, u.role_key, u.role_label, u.is_admin]
    );
    userIds[u.role_key] = rows[0].id;
    console.log(`Seeded: ${u.name.padEnd(14)} ${u.email.padEnd(36)} / ${u.password}  (${u.role_label})`);
  }

  const employeeId = userIds.QUALITY_EMPLOYEE;
  const headId = userIds.QUALITY_HEAD;
  const fallbackId = employeeId || headId || Object.values(userIds)[0];

  await pool.query(
    `UPDATE complaints SET assigned_to = $1 WHERE assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM users WHERE lower(email) = ANY($2::text[]))`,
    [fallbackId, emails]
  );
  await pool.query(
    `UPDATE complaints SET created_by = $1 WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM users WHERE lower(email) = ANY($2::text[]))`,
    [fallbackId, emails]
  );

  await pool.query(`DELETE FROM users WHERE lower(email) <> ALL($1::text[])`, [emails]);

  for (const c of SAMPLE_COMPLAINTS) {
    const assigned = c.stage === 'Closed' || c.stage === 'Verification' ? headId : employeeId;
    const history = [
      {
        date: new Date().toLocaleString(),
        action: 'Complaint raised (seed)',
        by: 'System',
      },
    ];
    await pool.query(
      `INSERT INTO complaints
        (id, description, part, customer, defect_category, severity, process, stage,
         history, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id,
        c.description,
        c.part,
        c.customer,
        c.defect_category,
        c.severity,
        c.process,
        c.stage,
        JSON.stringify(history),
        assigned,
        employeeId,
      ]
    );
  }

  await pool.query(
    `INSERT INTO kb_documents (name, content, uploaded_by)
     SELECT $1::text, $2::text, $3::uuid
     WHERE NOT EXISTS (SELECT 1 FROM kb_documents WHERE name = $1::text)`,
    [
      'Dimensional Tolerance SOP',
      'For shaft OD deviations beyond ±0.02mm: quarantine lot, verify CNC offset, recheck first article, update control plan.',
      headId,
    ]
  );

  await pool.end();
  console.log('\nSeed complete. Only the 5 SoftWorks users remain. Select a user on Login.');
}

seed().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
