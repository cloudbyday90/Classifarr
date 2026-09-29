-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Receipts and queue changes commit atomically; duplicate request IDs cannot reapply recovery.
CREATE UNIQUE INDEX idx_legacy_enrichment_retry_request
  ON audit_log ((metadata->>'requestId'))
  WHERE action='legacy_enrichment_retries_recovered';
