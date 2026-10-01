-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Actor/library-scoped retained history; no new retention policy or receipt writes.
CREATE INDEX idx_ingestion_reconciliation_history
  ON audit_log (user_id, (metadata->>'libraryId'), id DESC)
  WHERE action='library_ingestion_reconciled';
