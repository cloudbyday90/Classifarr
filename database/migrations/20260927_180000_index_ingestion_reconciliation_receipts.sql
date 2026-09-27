-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE UNIQUE INDEX idx_ingestion_reconciliation_request
  ON audit_log ((metadata->>'requestId'))
  WHERE action='library_ingestion_reconciled';
