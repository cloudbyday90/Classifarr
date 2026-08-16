/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildNativeIntentAuthoritySqlPredicate,
} from './policyNativeIntentAuthorityEligibility.mjs';

function asArray(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

async function loadNativeIntentReconciliationRemediationRecords({ db, limit }) {
  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({
    intentAlias: 'intent',
  });
  const result = await db.query(
    `SELECT
       state.policy_id,
       policy.library_id,
       policy.name AS policy_name,
       library.name AS library_name,
       library.media_type AS library_media_type,
       state.candidate_status_id,
       state.outcome_state,
       state.reason_id,
       state.evaluated_at,
       EXISTS (
         SELECT 1 FROM policy_presets preset WHERE preset.policy_id = state.policy_id
         UNION ALL
         SELECT 1 FROM policy_overrides policy_override
         WHERE policy_override.policy_id = state.policy_id
       ) AS legacy_configuration_present,
       EXISTS (
         SELECT 1
         FROM policy_intents intent
         WHERE intent.policy_id = state.policy_id
           AND ${authorityPredicate}
       ) AS native_authority_active
     FROM policy_native_intent_reconciliation_states state
     JOIN library_policies policy ON policy.id = state.policy_id
     JOIN libraries library ON library.id = policy.library_id
     ORDER BY
       CASE state.outcome_state
         WHEN 'requires_maintenance' THEN 0
         WHEN 'blocked_current_state' THEN 1
         WHEN 'system_failure' THEN 2
         ELSE 3
       END,
       state.evaluated_at ASC,
       state.policy_id ASC
     LIMIT $1`,
    [limit],
  );

  return asArray(result);
}

export {
  loadNativeIntentReconciliationRemediationRecords,
};
