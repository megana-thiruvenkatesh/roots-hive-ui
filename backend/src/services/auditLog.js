const pool = require('../db/pool');

let tableReady = false;

async function ensureAuditTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      user_name   VARCHAR(120),
      user_email  VARCHAR(160),
      dept        VARCHAR(60),
      module      VARCHAR(80) NOT NULL,
      action      VARCHAR(80) NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'ALLOWED',
      detail      TEXT,
      meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module)
  `);
  tableReady = true;
}

async function writeAuditLog({ user, module, action, status = 'ALLOWED', detail = '', meta = {} }) {
  try {
    await ensureAuditTable();
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_email, dept, module, action, status, detail, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user?.id || null,
        user?.name || null,
        user?.email || null,
        user?.dept || null,
        module,
        action,
        status,
        detail || null,
        JSON.stringify(meta || {}),
      ]
    );
  } catch (err) {
    console.error('audit log write failed', err);
  }
}

module.exports = { writeAuditLog, ensureAuditTable };
