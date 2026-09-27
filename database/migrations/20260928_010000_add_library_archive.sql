-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Archive is reversible and must never enable background work by itself.
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE libraries ADD CONSTRAINT library_archive_disabled CHECK (archived_at IS NULL OR is_active IS FALSE);
CREATE UNIQUE INDEX library_archive_request_receipt ON audit_log ((metadata->>'requestId'))
  WHERE action='library_archive_changed';
