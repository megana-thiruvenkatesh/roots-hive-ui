-- SSO + MFA support (run: psql -U postgres -d hive_roots -f database/migrations/002_sso_mfa.sql)

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN role_key SET DEFAULT 'USER';
ALTER TABLE users ALTER COLUMN role_label SET DEFAULT 'User';
ALTER TABLE users ALTER COLUMN dept SET DEFAULT 'General';

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(40) NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_subject VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

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
