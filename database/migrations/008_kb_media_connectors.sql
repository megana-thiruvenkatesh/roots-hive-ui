-- Knowledge Base file metadata + API connectors
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120);
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS record_count INTEGER DEFAULT 0;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS kb_connectors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  category     VARCHAR(40)  NOT NULL DEFAULT 'storage',
  provider     VARCHAR(80)  NOT NULL,
  config       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       VARCHAR(40)  NOT NULL DEFAULT 'CONFIGURED',
  last_sync    TIMESTAMPTZ,
  last_error   TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_connectors_created ON kb_connectors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_documents_created ON kb_documents(created_at DESC);
