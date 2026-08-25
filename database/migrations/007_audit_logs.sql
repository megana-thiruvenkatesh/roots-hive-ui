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
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
