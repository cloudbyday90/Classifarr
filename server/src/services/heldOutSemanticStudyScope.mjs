/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { createPolicyCandidateSemanticSnapshotFingerprint as fingerprint } from './policyCandidateSemanticSnapshotFingerprint.mjs';

export const HELD_OUT_SEMANTIC_STUDY_PROTOCOL = 'policy.held_out_semantic_study.v1';
const scopes = new WeakSet();

/** Freeze the complete cohort before any data-dependent preparation. */
export function createHeldOutSemanticStudyScope(identities) {
  if (!Array.isArray(identities) || identities.length < 24 || identities.length > 32) {
    throw new Error('invalid_held_out_cohort');
  }
  const keys = new Set();
  const entries = identities.map((identity) => {
    const { media_type: mediaType, tmdb_id: tmdbId } = identity ?? {};
    if (!['movie', 'tv'].includes(mediaType) || !Number.isInteger(tmdbId) ||
        tmdbId <= 0 || tmdbId > 2_147_483_647) throw new Error('invalid_held_out_identity');
    const key = `${mediaType}:${tmdbId}`;
    if (keys.has(key)) throw new Error('duplicate_held_out_identity');
    keys.add(key);
    return Object.freeze({ mediaType, tmdbId });
  }).sort((a, b) => a.mediaType.localeCompare(b.mediaType) || a.tmdbId - b.tmdbId);
  const scope = Object.freeze({
    entries: Object.freeze(entries),
    fingerprint: fingerprint({ entries, protocol: HELD_OUT_SEMANTIC_STUDY_PROTOCOL }),
  });
  scopes.add(scope);
  return scope;
}

export function assertHeldOutSemanticStudyScope(scope) {
  if (!scopes.has(scope)) throw new Error('invalid_held_out_scope');
  return scope;
}

export function heldOutSemanticStudyParameters(scope) {
  const { entries } = assertHeldOutSemanticStudyScope(scope);
  return [entries.map((entry) => entry.mediaType), entries.map((entry) => entry.tmdbId)];
}

export function assertHeldOutSemanticStudyMember(scope, metadata) {
  const { entries } = assertHeldOutSemanticStudyScope(scope);
  if (!entries.some((entry) => entry.mediaType === metadata?.media_type &&
      entry.tmdbId === metadata?.tmdb_id)) throw new Error('case_outside_held_out_cohort');
}

/** Never enable approximate-index starvation in the bounded offline study. */
export async function applyHeldOutSemanticStudyQuerySettings(client, scope) {
  assertHeldOutSemanticStudyScope(scope);
  await client.query("SELECT set_config('enable_indexscan', 'off', true)");
}
