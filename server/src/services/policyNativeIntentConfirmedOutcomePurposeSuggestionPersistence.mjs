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
  loadPolicyNativeIntentPurposeChangeReadContext,
} from './policyNativeIntentPurposeChangeReadPersistence.mjs';

const CONFIRMED_OUTCOME_SOURCE_SYSTEM = 'policy_authorized_compatibility';
const CONFIRMED_OUTCOME_AUTHORITY_SOURCE = 'manual_outcome';
const MIN_CONFIRMATION_COUNT = 3;
const MAX_SUGGESTED_GENRES = 5;

function asRows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

/**
 * Reads one current native-intent context and a fixed-size aggregate of genre
 * evidence that was created only from a policy-authorized manual outcome.
 *
 * This intentionally does not read media-server items, classification history,
 * profiles, vectors, prompts, model output, or raw evidence data. The browser
 * later receives only the terms that can be reviewed in the existing purpose
 * editor, never individual outcomes or the evidence rows that produced them.
 */
async function loadPolicyNativeIntentConfirmedOutcomePurposeSuggestionContext({ db, policyId } = {}) {
  const context = await loadPolicyNativeIntentPurposeChangeReadContext({ db, policyId });
  if (!context || context.authority?.authoritative !== true || !context.activeIntent?.id) {
    return context ? { ...context, confirmedOutcomeGenres: [] } : null;
  }

  const result = await db.query(
    `SELECT
       evidence_key,
       LEAST(usage_count + 1, 50)::INTEGER AS confirmation_count
     FROM classification_evidence
     WHERE scope = 'genre'
       AND status = 'active'
       AND library_id = $1
       AND LOWER(media_type) = LOWER($2)
       AND source_system = $3
       AND evidence_data @> $4::jsonb
       AND usage_count >= $5
     ORDER BY usage_count DESC, confidence DESC, evidence_key ASC
     LIMIT $6`,
    [
      context.library_id,
      context.library_media_type,
      CONFIRMED_OUTCOME_SOURCE_SYSTEM,
      JSON.stringify({ authoritySourceId: CONFIRMED_OUTCOME_AUTHORITY_SOURCE }),
      MIN_CONFIRMATION_COUNT - 1,
      MAX_SUGGESTED_GENRES,
    ],
  );

  return {
    ...context,
    confirmedOutcomeGenres: asRows(result),
  };
}

export {
  CONFIRMED_OUTCOME_AUTHORITY_SOURCE,
  CONFIRMED_OUTCOME_SOURCE_SYSTEM,
  MAX_SUGGESTED_GENRES,
  MIN_CONFIRMATION_COUNT,
  loadPolicyNativeIntentConfirmedOutcomePurposeSuggestionContext,
};
