-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
ALTER TABLE adjudication_capture_budget ADD COLUMN finalization_attempt_id uuid;
COMMENT ON COLUMN adjudication_capture_budget.finalization_attempt_id IS
  'Private owner-session claim for participating capture finalizers; NULL confers no authority. Not portable configuration.';
