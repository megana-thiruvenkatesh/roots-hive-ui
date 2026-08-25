-- Notifications + complaint approval workflow
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  type          VARCHAR(60) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT,
  complaint_id  VARCHAR(40),
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id) WHERE read_at IS NULL;
