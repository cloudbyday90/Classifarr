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

function asArray(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

function buildActiveNativePoliciesSql(authorityPredicate) {
  return `SELECT
         policy.id AS policy_id,
         intent.id AS intent_id
       FROM library_policies policy
       JOIN libraries library ON library.id = policy.library_id
       JOIN policy_intents intent
         ON intent.policy_id = policy.id
        AND intent.library_id = policy.library_id
       WHERE policy.enabled = TRUE
         AND library.is_active = TRUE
         AND ${authorityPredicate}`;
}

/**
 * Reads aggregate source eligibility for the private held-out study. A policy
 * can qualify only when its current retained purpose and every recorded normal
 * lifecycle receipt agree. The query intentionally returns counts only.
 */
export async function loadPolicyPurposeCoverageStudySourceReadinessRecord({ db }) {
  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({
    intentAlias: 'intent',
  });
  const result = await db.query(
    `WITH active_native_policies AS (
       ${buildActiveNativePoliciesSql(authorityPredicate)}
     ),
     current_purpose_provenance AS (
       SELECT
         active.policy_id,
         COUNT(rule.id)::INTEGER AS specialized_purpose_rule_count,
         COUNT(rule.id) FILTER (
           WHERE rule.source = 'media_server_library_profile'
             AND rule.inference_state = 'inferred'
         )::INTEGER AS inferred_profile_purpose_rule_count
       FROM active_native_policies active
       LEFT JOIN policy_intent_rules rule
         ON rule.intent_id = active.intent_id
        AND rule.intent_role = 'purpose'
        AND rule.semantics = 'identity'
        AND rule.signal_type IN ('genres', 'keywords', 'studios')
       GROUP BY active.policy_id
     ),
     normal_lifecycle_receipts AS (
       SELECT
         establishment.policy_id,
         establishment.intent_id,
         NULL::INTEGER AS expected_intent_version
       FROM policy_initial_intent_establishments establishment
       JOIN active_native_policies active ON active.policy_id = establishment.policy_id
       WHERE establishment.state = 'established'
         AND establishment.intent_id IS NOT NULL

       UNION ALL

       SELECT
         change_receipt.policy_id,
         change_receipt.target_intent_id AS intent_id,
         change_receipt.target_intent_version AS expected_intent_version
       FROM policy_native_intent_change_receipts change_receipt
       JOIN active_native_policies active ON active.policy_id = change_receipt.policy_id
       WHERE change_receipt.result_status_id = 'applied'
     ),
     lifecycle_receipt_provenance AS (
       SELECT
         receipt.policy_id,
         receipt.intent_id,
         intent.id IS NOT NULL AS intent_available,
         COUNT(rule.id)::INTEGER AS specialized_purpose_rule_count,
         COUNT(rule.id) FILTER (
           WHERE rule.source = 'media_server_library_profile'
             AND rule.inference_state = 'inferred'
         )::INTEGER AS inferred_profile_purpose_rule_count
       FROM normal_lifecycle_receipts receipt
       LEFT JOIN policy_intents intent
         ON intent.id = receipt.intent_id
        AND intent.policy_id = receipt.policy_id
        AND intent.source = 'native_intent'
        AND (
          receipt.expected_intent_version IS NULL
          OR intent.intent_version = receipt.expected_intent_version
        )
       LEFT JOIN policy_intent_rules rule
         ON rule.intent_id = intent.id
        AND rule.intent_role = 'purpose'
        AND rule.semantics = 'identity'
        AND rule.signal_type IN ('genres', 'keywords', 'studios')
       GROUP BY receipt.policy_id, receipt.intent_id, intent.id
     ),
     lifecycle_source_state AS (
       SELECT
         active.policy_id,
         COUNT(receipt.policy_id)::INTEGER AS normal_lifecycle_receipt_count,
         COUNT(receipt.policy_id) FILTER (
           WHERE receipt.intent_available
         )::INTEGER AS verifiable_lifecycle_receipt_count,
         COUNT(receipt.policy_id) FILTER (
           WHERE receipt.intent_available
             AND receipt.specialized_purpose_rule_count
               > receipt.inferred_profile_purpose_rule_count
         )::INTEGER AS retained_purpose_lifecycle_receipt_count
       FROM active_native_policies active
       LEFT JOIN lifecycle_receipt_provenance receipt ON receipt.policy_id = active.policy_id
       GROUP BY active.policy_id
     ),
     source_policy_state AS (
       SELECT
         active.policy_id,
         current_purpose.specialized_purpose_rule_count,
         current_purpose.inferred_profile_purpose_rule_count,
         lifecycle.normal_lifecycle_receipt_count,
         lifecycle.verifiable_lifecycle_receipt_count,
         lifecycle.retained_purpose_lifecycle_receipt_count
       FROM active_native_policies active
       JOIN current_purpose_provenance current_purpose
         ON current_purpose.policy_id = active.policy_id
       JOIN lifecycle_source_state lifecycle ON lifecycle.policy_id = active.policy_id
     )
     SELECT
       COUNT(*)::INTEGER AS active_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > 0
           AND specialized_purpose_rule_count = inferred_profile_purpose_rule_count
       )::INTEGER AS profile_only_purpose_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
       )::INTEGER AS retained_purpose_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
           AND normal_lifecycle_receipt_count > 0
           AND normal_lifecycle_receipt_count = verifiable_lifecycle_receipt_count
           AND normal_lifecycle_receipt_count = retained_purpose_lifecycle_receipt_count
       )::INTEGER AS lifecycle_retained_purpose_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
           AND normal_lifecycle_receipt_count = 0
       )::INTEGER AS lifecycle_receipt_required_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
           AND normal_lifecycle_receipt_count > 0
           AND NOT (
             normal_lifecycle_receipt_count = verifiable_lifecycle_receipt_count
             AND normal_lifecycle_receipt_count = retained_purpose_lifecycle_receipt_count
           )
       )::INTEGER AS lifecycle_receipt_review_required_policy_count
     FROM source_policy_state`,
  );

  return asArray(result)[0] || {};
}
