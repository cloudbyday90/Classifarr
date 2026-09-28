-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE media_server_catalog_status
  ADD COLUMN automatic_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (automatic_attempts BETWEEN 0 AND 5),
  ADD COLUMN recovery_state TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (recovery_state IN ('scheduled','cooldown','waiting_configuration','needs_review')),
  ADD COLUMN next_attempt_at TIMESTAMPTZ;

-- Adopt previous evidence conservatively; upgrades never create an immediate retry storm.
UPDATE media_server_catalog_status SET
  automatic_attempts=CASE WHEN reason='complete' THEN 0 ELSE 1 END,
  recovery_state=CASE WHEN reason IN ('authentication','forbidden') THEN 'waiting_configuration'
    WHEN reason IN ('complete','checking','unreachable','timeout','rate_limited')
      OR (reason='provider_unavailable' AND http_status NOT IN (501,505)) THEN 'scheduled'
    ELSE 'needs_review' END;
UPDATE media_server_catalog_status SET next_attempt_at=GREATEST(clock_timestamp(),COALESCE(finished_at,started_at))+INTERVAL '6 hours'
  WHERE recovery_state='scheduled';
ALTER TABLE media_server_catalog_status ADD CONSTRAINT media_server_catalog_recovery_due
  CHECK ((recovery_state IN ('scheduled','cooldown')) = (next_attempt_at IS NOT NULL));
