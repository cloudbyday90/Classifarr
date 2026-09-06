-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
CREATE TABLE IF NOT EXISTS policy_tuning_cohorts (
    fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    policy_id integer NOT NULL REFERENCES library_policies(id) ON DELETE CASCADE,
    manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'object' AND octet_length(manifest::text) <= 4194304),
    created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policy_tuning_cohorts_policy ON policy_tuning_cohorts(policy_id);

ALTER TABLE policy_tuning_suggestions
    ADD COLUMN IF NOT EXISTS cohort_fingerprint text REFERENCES policy_tuning_cohorts(fingerprint),
    ADD COLUMN IF NOT EXISTS evidence_fingerprint text,
    ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_policy_tuning_suggestions_cohort ON policy_tuning_suggestions(cohort_fingerprint);

CREATE OR REPLACE FUNCTION reject_policy_tuning_cohort_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Suggestion cohorts are immutable' USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER IF EXISTS policy_tuning_cohorts_immutable ON policy_tuning_cohorts;
CREATE TRIGGER policy_tuning_cohorts_immutable BEFORE UPDATE ON policy_tuning_cohorts
FOR EACH ROW EXECUTE FUNCTION reject_policy_tuning_cohort_update();
