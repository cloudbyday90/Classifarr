/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, sourceConflictAuthorityExclusionForMediaServerItem } from './sourceConflictAuthorityGuard.mjs';
import { heldOutSemanticStudyInventoryCandidate } from './heldOutSemanticStudyInventoryCandidate.mjs';

export const HELD_OUT_SEMANTIC_STUDY_INVENTORY_AUDIT_MAXIMUM_CANDIDATES = 8_000;

function validMaximumCandidateCount(value) {
  return Number.isInteger(value) && value >= 24 &&
    value <= HELD_OUT_SEMANTIC_STUDY_INVENTORY_AUDIT_MAXIMUM_CANDIDATES;
}

/**
 * Reads a bounded canonical inventory population for a content-free
 * broad-policy availability audit. One additional row detects truncation;
 * no identity survives this function's caller boundary.
 */
export async function readHeldOutSemanticStudyInventoryAuditCandidates({
  query,
  maximumCandidateCount = HELD_OUT_SEMANTIC_STUDY_INVENTORY_AUDIT_MAXIMUM_CANDIDATES,
} = {}) {
  if (typeof query !== 'function' || !validMaximumCandidateCount(maximumCandidateCount)) {
    throw new Error('invalid_held_out_inventory_audit_request');
  }

  const result = await query(
    `WITH canonical_items AS (
       SELECT DISTINCT ON (msi.media_type, msi.tmdb_id)
         msi.id, msi.content_rating, msi.genres, msi.media_type, msi.metadata,
         msi.tmdb_id, msi.title, msi.year
       FROM media_server_items AS msi
       WHERE msi.media_type IN ('movie', 'tv')
         AND msi.tmdb_id > 0
         AND msi.title IS NOT NULL
         AND btrim(msi.title) <> ''
         AND char_length(msi.title) <= 220
         AND ${sourceConflictAuthorityExclusionForMediaServerItem('$1')}
       ORDER BY msi.media_type, msi.tmdb_id, msi.id
     ), stratified AS (
       SELECT canonical_items.*,
         CASE
           WHEN 'Reality' = ANY(genres) THEN 'reality'
           WHEN 'Documentary' = ANY(genres) THEN 'documentary'
           WHEN cardinality(genres) >= 2 THEN 'genre-overlap'
           ELSE 'ordinary'
         END AS study_stratum
       FROM canonical_items
     )
     SELECT stratified.content_rating, stratified.genres, stratified.media_type,
       stratified.metadata, stratified.study_stratum, stratified.tmdb_id,
       stratified.title, stratified.year, history.metadata AS history_metadata
     FROM stratified
     LEFT JOIN LATERAL (
       SELECT metadata
       FROM classification_history
       WHERE tmdb_id = stratified.tmdb_id
         AND media_type = stratified.media_type
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) AS history ON true
     ORDER BY stratified.media_type, stratified.tmdb_id
     LIMIT $2`,
    [SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, maximumCandidateCount + 1],
  );

  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const truncated = rows.length > maximumCandidateCount;
  const candidates = [];
  const identities = new Set();
  for (const row of rows.slice(0, maximumCandidateCount)) {
    const candidate = heldOutSemanticStudyInventoryCandidate(row);
    const identity = `${candidate.metadata.media_type}:${candidate.metadata.tmdb_id}`;
    if (identities.has(identity)) throw new Error('duplicate_held_out_inventory_identity');
    identities.add(identity);
    candidates.push(candidate);
  }
  return Object.freeze({ candidates: Object.freeze(candidates), truncated });
}
