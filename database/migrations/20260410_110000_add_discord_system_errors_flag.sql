-- Add opt-out toggle for system health Discord alerts.
-- DEFAULT TRUE: existing users who have Discord configured automatically receive
-- health event notifications without any manual action required.
-- New users start with it enabled and can opt out in Settings → Discord.
ALTER TABLE notification_config
  ADD COLUMN IF NOT EXISTS notify_on_system_errors BOOLEAN NOT NULL DEFAULT TRUE;
