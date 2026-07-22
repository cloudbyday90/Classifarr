/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

async function readStoredLibraryProfileForProvenance({ client, libraryId }) {
  const result = await client.query(
    `SELECT
       library_id,
       item_count,
       enriched_count,
       rating_distribution,
       genre_distribution,
       studio_distribution,
       keyword_distribution,
       exclusion_ratings,
       exclusion_genres,
       exclusion_keywords,
       last_generated_at,
       updated_at
     FROM library_profiles
     WHERE library_id = $1
     LIMIT 1`,
    [libraryId]
  );

  return firstRow(result);
}

async function insertObservedEvidenceProvenanceSnapshot({
  client,
  establishmentId,
  policyId,
  libraryId,
  intentId,
  provenance,
}) {
  const result = await client.query(
    `INSERT INTO policy_observed_evidence_provenance_snapshots (
       establishment_id,
       policy_id,
       library_id,
       intent_id,
       snapshot_version,
       source_id,
       capture_state,
       capture_reason_id,
       profile_freshness_state,
       source_profile_generated_at,
       source_profile_updated_at,
       evidence_fingerprint,
       snapshot_payload,
       payload_redacted,
       expires_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, FALSE, $14
     )
     RETURNING id`,
    [
      establishmentId,
      policyId,
      libraryId,
      intentId,
      provenance.snapshotVersion,
      provenance.sourceId,
      provenance.captureState,
      provenance.captureReasonId,
      provenance.profileFreshnessState,
      provenance.sourceProfileGeneratedAt,
      provenance.sourceProfileUpdatedAt,
      provenance.evidenceFingerprint,
      JSON.stringify(provenance.snapshotPayload),
      provenance.expiresAt,
    ]
  );

  return firstRow(result)?.id ?? null;
}

export {
  insertObservedEvidenceProvenanceSnapshot,
  readStoredLibraryProfileForProvenance,
};
