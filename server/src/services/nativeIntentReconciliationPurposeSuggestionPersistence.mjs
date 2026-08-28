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
  buildNativeIntentAuthoritySqlPredicate,
} from './policyNativeIntentAuthorityEligibility.mjs';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

/**
 * Loads the minimum current evidence needed to prepare a read-only purpose
 * suggestion. This query deliberately does not return raw media items, paths,
 * compatibility JSON, or a native-intent payload.
 */
async function loadNativeIntentReconciliationPurposeSuggestionRecord({ db, policyId } = {}) {
  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({
    intentAlias: 'intent',
  });
  const result = await db.query(
    `SELECT
       policy.id AS policy_id,
       policy.library_id,
       policy.name AS policy_name,
       library.name AS library_name,
       library.media_type AS library_media_type,
       state.candidate_status_id,
       state.outcome_state,
       state.reason_id,
       profile.item_count,
       profile.last_generated_at,
       profile.genre_distribution,
       EXISTS (
         SELECT 1
         FROM policy_intents intent
         WHERE intent.policy_id = policy.id
           AND ${authorityPredicate}
       ) AS native_authority_active
     FROM library_policies policy
     JOIN libraries library ON library.id = policy.library_id
     LEFT JOIN policy_native_intent_reconciliation_states state
       ON state.policy_id = policy.id
     LEFT JOIN library_profiles profile ON profile.library_id = policy.library_id
     WHERE policy.id = $1`,
    [policyId],
  );

  return firstRow(result);
}

export {
  loadNativeIntentReconciliationPurposeSuggestionRecord,
};
