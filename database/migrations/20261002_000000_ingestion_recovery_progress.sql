-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE ingestion_recovery_progress (
  audit_id INTEGER PRIMARY KEY REFERENCES audit_log(id) ON DELETE CASCADE,
  library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  request_id UUID NOT NULL UNIQUE,
  run_id UUID NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('requested','importing','backfilling','completed','superseded')),
  reason TEXT CHECK (reason IN ('new_scan','new_recovery','source_changed')),
  source_id INTEGER NOT NULL,
  source_fingerprint TEXT NOT NULL CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  source_external_id TEXT NOT NULL,
  source_media_type TEXT NOT NULL CHECK (source_media_type IN ('movie','tv')),
  imported_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  metadata_total INTEGER CHECK (metadata_total >= 0),
  metadata_ready INTEGER CHECK (metadata_ready >= 0),
  metadata_pending INTEGER CHECK (metadata_pending >= 0),
  metadata_blocked INTEGER CHECK (metadata_blocked >= 0),
  UNIQUE (library_id, run_id),
  CHECK ((metadata_total IS NULL AND metadata_ready IS NULL AND metadata_pending IS NULL AND metadata_blocked IS NULL)
    OR (metadata_total IS NOT NULL AND metadata_ready IS NOT NULL AND metadata_pending IS NOT NULL
      AND metadata_blocked IS NOT NULL AND metadata_total::bigint = metadata_ready::bigint + metadata_pending::bigint + metadata_blocked::bigint)),
  CHECK (stage <> 'completed' OR (imported_at IS NOT NULL AND verified_at IS NOT NULL
    AND checked_at IS NOT NULL AND metadata_total IS NOT NULL AND metadata_ready IS NOT NULL
    AND metadata_pending IS NOT NULL AND metadata_blocked IS NOT NULL
    AND metadata_ready = metadata_total AND metadata_pending = 0 AND metadata_blocked = 0))
);
CREATE INDEX idx_ingestion_recovery_verification_due
  ON ingestion_recovery_progress(next_check_at,audit_id) WHERE stage='backfilling';
