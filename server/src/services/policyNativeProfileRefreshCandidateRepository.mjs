/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
} from './policyLibraryProfileEvidenceLoader.mjs';
import {
  POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS,
} from './policyNativeProfileRefreshRequest.mjs';

const POLICY_NATIVE_PROFILE_REFRESH_CANDIDATE_BATCH_SIZE = 25;

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeLibraryId(value) {
  const libraryId = Number(value);
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null;
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeCandidate(row = {}) {
  const libraryId = Number(row.library_id);
  const profileState = row.profile_state;

  if (
    !Number.isInteger(libraryId) ||
    libraryId <= 0 ||
    !Object.values(POLICY_NATIVE_PROFILE_REFRESH_PROFILE_STATE_IDS).includes(profileState)
  ) {
    return null;
  }

  return {
    libraryId,
    profileState,
    profileGeneratedAt: normalizeTimestamp(row.profile_last_generated_at),
    observedItemCount: Number(row.observed_item_count) || null,
    observedItemHighWaterMark: Number(row.observed_item_high_water_mark) || null,
  };
}

async function findPolicyNativeProfileRefreshCandidates({
  client,
  limit = POLICY_NATIVE_PROFILE_REFRESH_CANDIDATE_BATCH_SIZE,
  maximumAgeMs = POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
  libraryId = null,
} = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Native profile refresh candidate discovery requires a database client.');
  }

  const normalizedLibraryId = libraryId === null || libraryId === undefined
    ? null
    : normalizeLibraryId(libraryId);
  if (libraryId !== null && libraryId !== undefined && !normalizedLibraryId) {
    return [];
  }

  const result = await client.query(
    `WITH active_native_libraries AS (
       SELECT DISTINCT policy.library_id
       FROM library_policies AS policy
       JOIN libraries AS library
         ON library.id = policy.library_id
      JOIN policy_intents AS intent
         ON intent.policy_id = policy.id
        AND intent.active = TRUE
      WHERE policy.library_id IS NOT NULL
        AND ($3::bigint IS NULL OR policy.library_id = $3)
        AND COALESCE(policy.enabled, TRUE) = TRUE
         AND COALESCE(library.is_active, TRUE) = TRUE
     )
     SELECT
       native_library.library_id,
       profile.last_generated_at AS profile_last_generated_at,
       observed_items.item_count AS observed_item_count,
       observed_items.high_water_mark AS observed_item_high_water_mark,
       CASE
         WHEN profile.library_id IS NULL OR profile.last_generated_at IS NULL
           THEN 'missing_profile'
         ELSE 'stale_profile'
       END AS profile_state
     FROM active_native_libraries AS native_library
     JOIN LATERAL (
       SELECT
         COUNT(*)::integer AS item_count,
         MAX(item.id)::integer AS high_water_mark
       FROM media_server_items AS item
       WHERE item.library_id = native_library.library_id
     ) AS observed_items
       ON observed_items.item_count > 0
     LEFT JOIN library_profiles AS profile
       ON profile.library_id = native_library.library_id
     WHERE profile.library_id IS NULL
        OR profile.last_generated_at IS NULL
        OR profile.last_generated_at <= NOW() - ($1::bigint * INTERVAL '1 millisecond')
     ORDER BY profile.last_generated_at ASC NULLS FIRST, native_library.library_id ASC
     LIMIT $2`,
    [
      normalizePositiveInteger(
        maximumAgeMs,
        POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
      ),
      normalizePositiveInteger(limit, POLICY_NATIVE_PROFILE_REFRESH_CANDIDATE_BATCH_SIZE),
      normalizedLibraryId,
    ],
  );

  return Array.isArray(result?.rows)
    ? result.rows.map(normalizeCandidate).filter(Boolean)
    : [];
}

async function findPolicyNativeProfileRefreshCandidateForLibrary({
  client,
  libraryId,
  maximumAgeMs = POLICY_LIBRARY_PROFILE_FRESHNESS_MAX_AGE_MS,
} = {}) {
  const candidates = await findPolicyNativeProfileRefreshCandidates({
    client,
    libraryId,
    limit: 1,
    maximumAgeMs,
  });

  return candidates[0] || null;
}

const policyNativeProfileRefreshCandidateRepository = Object.freeze({
  findCandidateForLibrary: findPolicyNativeProfileRefreshCandidateForLibrary,
  findCandidates: findPolicyNativeProfileRefreshCandidates,
});

export {
  findPolicyNativeProfileRefreshCandidateForLibrary,
  findPolicyNativeProfileRefreshCandidates,
  normalizeCandidate,
  policyNativeProfileRefreshCandidateRepository,
  POLICY_NATIVE_PROFILE_REFRESH_CANDIDATE_BATCH_SIZE,
};
