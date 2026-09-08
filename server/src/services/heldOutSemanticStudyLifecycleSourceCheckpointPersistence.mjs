/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_SOURCE_CHECKPOINT_KEY =
  'normal_policy_lifecycle_source';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

/**
 * Loads only the digest used to detect an aggregate lifecycle-source change.
 * The source receipt remains private durable provenance and is never projected
 * back into the scheduler.
 */
export async function loadHeldOutSemanticStudyLifecycleSourceCheckpoint({ db }) {
  const result = await db.query(
    `SELECT source_fingerprint
       FROM held_out_semantic_study_lifecycle_source_checkpoint
      WHERE state_key = $1`,
    [HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_SOURCE_CHECKPOINT_KEY],
  );
  const row = firstRow(result);
  if (!row) return null;

  return Object.freeze({
    sourceFingerprint: typeof row.source_fingerprint === 'string' ? row.source_fingerprint : null,
  });
}

/**
 * Records a changed aggregate source even when it cannot yet run an audit.
 * This checkpoint has no audit status or result, so a deferred state cannot be
 * mistaken for a completed measurement.
 */
export async function saveHeldOutSemanticStudyLifecycleSourceCheckpoint({
  db,
  source,
  sourceFingerprint,
  observedAt,
}) {
  await db.query(
    `INSERT INTO held_out_semantic_study_lifecycle_source_checkpoint (
       state_key,
       source_fingerprint,
       source_receipt,
       observed_at
     ) VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (state_key) DO UPDATE SET
       source_fingerprint = EXCLUDED.source_fingerprint,
       source_receipt = EXCLUDED.source_receipt,
       observed_at = EXCLUDED.observed_at`,
    [
      HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_SOURCE_CHECKPOINT_KEY,
      sourceFingerprint,
      JSON.stringify(source),
      observedAt,
    ],
  );
}
