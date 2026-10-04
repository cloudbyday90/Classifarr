-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Future notifications carry a durable footer reference. NULL means legacy;
-- neither migration nor an old writer may fabricate correlation evidence.
ALTER TABLE discord_notification_deliveries
  ADD COLUMN IF NOT EXISTS correlation_version SMALLINT
    CHECK (correlation_version = 1);
