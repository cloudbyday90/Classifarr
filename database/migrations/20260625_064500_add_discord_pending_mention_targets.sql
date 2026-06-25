-- Add bounded Discord mention targeting for pending classification alerts.

ALTER TABLE notification_config
  ADD COLUMN IF NOT EXISTS pending_mention_here BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_mention_type VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pending_mention_target_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pending_mention_target_label VARCHAR(150);

ALTER TABLE notification_config
  DROP CONSTRAINT IF EXISTS notification_config_pending_mention_type_check;

ALTER TABLE notification_config
  ADD CONSTRAINT notification_config_pending_mention_type_check
  CHECK (pending_mention_type IN ('none', 'user', 'role'));
