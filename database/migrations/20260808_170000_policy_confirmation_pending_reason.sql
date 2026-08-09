-- Keep existing active policy-confirmation records aligned with the current
-- operator vocabulary. This is deliberately limited to the deterministic
-- prompt-confirm action and preserves all history and question payloads.
BEGIN;

UPDATE classification_history
SET pending_reason = 'Policy confirmation required'
WHERE status = 'awaiting_decision'
  AND pending_reason = 'Missing evidence'
  AND metadata->'policyResult'->>'action' = 'prompt_confirm';

COMMIT;
