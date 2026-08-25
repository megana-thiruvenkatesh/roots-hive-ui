-- ============================================================================
-- HIVE ROOTS — PostgreSQL Schema
-- Run: createdb hive_roots && psql -d hive_roots -f database/schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(120) NOT NULL,
  email            VARCHAR(160) UNIQUE NOT NULL,
  password_hash    TEXT,
  dept             VARCHAR(60)  NOT NULL DEFAULT 'General',
  role_key         VARCHAR(40)  NOT NULL DEFAULT 'USER',
  role_label       VARCHAR(80)  NOT NULL DEFAULT 'User',
  is_admin         BOOLEAN NOT NULL DEFAULT FALSE,
  auth_provider    VARCHAR(40)  NOT NULL DEFAULT 'local',
  provider_subject VARCHAR(255),
  avatar_url       TEXT,
  last_login_at    TIMESTAMPTZ,
  profile_details  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_subject
  ON users (auth_provider, provider_subject)
  WHERE provider_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_user ON mfa_challenges(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL,
  text            TEXT NOT NULL,
  meta            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS complaints (
  id                  VARCHAR(40) PRIMARY KEY,
  type                VARCHAR(40) NOT NULL DEFAULT 'Complaint',
  description         TEXT NOT NULL,
  part                VARCHAR(120),
  customer            VARCHAR(160),
  defect_category     VARCHAR(100),
  severity            VARCHAR(30) NOT NULL DEFAULT 'Major',
  process             VARCHAR(100),
  stage               VARCHAR(40) NOT NULL DEFAULT 'Open',
  raised_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  root_cause          TEXT,
  corrective_action   TEXT,
  preventive_action   TEXT,
  why_why             JSONB,
  cft_team            VARCHAR(255),
  part_code           VARCHAR(120),
  lot_qty             NUMERIC,
  defect_qty          NUMERIC,
  rejection_pct       NUMERIC,
  assigned_to         UUID REFERENCES users(id),
  history             JSONB NOT NULL DEFAULT '[]',
  tasks               JSONB NOT NULL DEFAULT '[]',
  attachments         JSONB NOT NULL DEFAULT '[]',
  wizard_data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaints_stage ON complaints(stage);
CREATE INDEX IF NOT EXISTS idx_complaints_severity ON complaints(severity);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON complaints(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaints_fts ON complaints
  USING GIN (to_tsvector('english',
    coalesce(description,'') || ' ' || coalesce(part,'') || ' ' || coalesce(customer,'') || ' ' ||
    coalesce(defect_category,'') || ' ' || coalesce(root_cause,'') || ' ' ||
    coalesce(corrective_action,'') || ' ' || coalesce(preventive_action,'')
  ));

CREATE TABLE IF NOT EXISTS kb_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  source_type VARCHAR(40) NOT NULL DEFAULT 'General',
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(60) PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

INSERT INTO app_settings (key, value) VALUES
  ('api_settings', '{"enabled": true, "provider": "builtin", "model": "Xenova/Qwen1.5-0.5B-Chat", "maxTokens": 1000, "temperature": 0.7}'),
  ('branding', '{"appName": "HIVE Roots", "logoIcon": "⬡"}')
ON CONFLICT (key) DO NOTHING;
