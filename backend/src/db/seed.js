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
    dept: 'IT Security',
    role_key: 'ADMIN',
    role_label: 'Admin',
    is_admin: true,
  },
  {
    name: 'Megana',
    email: 'meganat2002@gmail.com',
    password: 'Quality@123',
    dept: 'Quality',
    role_key: 'QUALITY_EMPLOYEE',
    role_label: 'Quality Worker',
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

const SAMPLE_COMPLAINTS = [];

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

  // No sample complaints / KB docs — start empty; historic data comes from Uploaded Datasets Excel only.

  await pool.end();
  console.log('\nSeed complete (users only). Complaints/KB left empty for a fresh start.');
}

seed().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
