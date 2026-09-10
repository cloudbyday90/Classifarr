/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

function requiredUtcDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new TypeError('A UTC observation date is required.');
  }
  return value;
}

/** Persists a pre-projected aggregate receipt; never accepts raw replay data. */
export async function upsertSourceIdentityEvidenceReplayObservation({
  query,
  observedOn,
  observedAt,
  observation,
} = {}) {
  if (typeof query !== 'function' || typeof observedAt !== 'string' || !observation ||
      typeof observation.version !== 'string' || typeof observation.status?.id !== 'string') {
    throw new TypeError('A projected source identity evidence replay observation is required.');
  }
  return query(`INSERT INTO source_identity_evidence_replay_observations
    (observed_on, observed_at, receipt_version, status_id, observation)
    VALUES ($1::date, $2::timestamptz, $3, $4, $5::jsonb)
    ON CONFLICT (observed_on) DO UPDATE SET
      observed_at=EXCLUDED.observed_at,
      receipt_version=EXCLUDED.receipt_version,
      status_id=EXCLUDED.status_id,
      observation=EXCLUDED.observation`, [
    requiredUtcDate(observedOn), observedAt, observation.version, observation.status.id, JSON.stringify(observation),
  ]);
}

export async function deleteExpiredSourceIdentityEvidenceReplayObservations({
  query,
  cutoffOn,
} = {}) {
  if (typeof query !== 'function') throw new TypeError('A database query is required.');
  return query(`DELETE FROM source_identity_evidence_replay_observations
    WHERE observed_on < $1::date`, [requiredUtcDate(cutoffOn)]);
}
