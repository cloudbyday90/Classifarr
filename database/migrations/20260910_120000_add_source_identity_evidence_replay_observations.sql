-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program. If not, see <https://www.gnu.org/licenses/>.

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
