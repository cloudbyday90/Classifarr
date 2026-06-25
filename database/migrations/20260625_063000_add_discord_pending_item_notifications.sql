-- Add Discord notification control for pending classification items.

ALTER TABLE notification_config
  ADD COLUMN IF NOT EXISTS notify_on_pending_items BOOLEAN NOT NULL DEFAULT TRUE;
