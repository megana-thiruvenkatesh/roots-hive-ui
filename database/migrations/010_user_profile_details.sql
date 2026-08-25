-- Extended My Profile fields (personal / location / preferences)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_details JSONB NOT NULL DEFAULT '{}'::jsonb;
