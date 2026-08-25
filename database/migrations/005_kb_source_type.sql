-- Tag knowledge docs by complaint type data source
ALTER TABLE kb_documents
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(40) NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_kb_source_type ON kb_documents(source_type);
