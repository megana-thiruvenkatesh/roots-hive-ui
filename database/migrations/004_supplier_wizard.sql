-- Supplier 8D wizard state (multi-step form)
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS wizard_data JSONB NOT NULL DEFAULT '{}'::jsonb;
