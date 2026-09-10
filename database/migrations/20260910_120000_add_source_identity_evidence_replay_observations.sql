-- Aggregate-only history for the bounded, provider-neutral source identity replay.
-- The receipt contract excludes media, library/server, provider, candidate, URL,
-- credential, configuration, policy, AI, decision, and routing values.
CREATE TABLE IF NOT EXISTS source_identity_evidence_replay_observations (
  observed_on DATE PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL,
  receipt_version VARCHAR(96) NOT NULL,
  status_id VARCHAR(48) NOT NULL CHECK (status_id IN ('complete', 'failed', 'no_current_conflicts')),
  observation JSONB NOT NULL
);

COMMENT ON TABLE source_identity_evidence_replay_observations IS
  'Daily aggregate-only source identity evidence replay receipts; no source or provider identities retained.';
