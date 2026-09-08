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
import {
  buildPolicyPurposeLifecycleReceiptSourceCtesSql,
} from './policyPurposeLifecycleReceiptSources.mjs';

function asArray(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

function buildActiveNativePoliciesSql(authorityPredicate) {
  return `SELECT
         policy.id AS policy_id,
         intent.id AS intent_id,
         intent.intent_version,
         intent.schema_version
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
 * Reads availability evidence for active authoritative native policies. The
 * query returns fixed aggregate counts only. It does not select library,
 * policy, media, rule-value, author, receipt, or provider identity.
 */
export async function loadPolicyPurposeEvidenceInventoryRecord({ db }) {
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
     ${buildPolicyPurposeLifecycleReceiptSourceCtesSql({
       scope: 'active-policy-inventory',
     })},
     lifecycle_receipt_provenance AS (
       SELECT
         receipt.policy_id,
         receipt.intent_id,
         receipt.expected_intent_version,
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
       GROUP BY receipt.policy_id, receipt.intent_id, receipt.expected_intent_version, intent.id
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
         )::INTEGER AS retained_purpose_lifecycle_receipt_count,
         COUNT(receipt.policy_id) FILTER (
           WHERE receipt.intent_available
             AND receipt.intent_id = active.intent_id
             AND (
               receipt.expected_intent_version IS NULL
               OR receipt.expected_intent_version = active.intent_version
             )
         )::INTEGER AS current_intent_lifecycle_receipt_count
       FROM active_native_policies active
       LEFT JOIN lifecycle_receipt_provenance receipt ON receipt.policy_id = active.policy_id
       GROUP BY active.policy_id
     ),
     evidence_policy_state AS (
       SELECT
         active.policy_id,
         active.intent_version,
         active.schema_version,
         current_purpose.specialized_purpose_rule_count,
         current_purpose.inferred_profile_purpose_rule_count,
         lifecycle.normal_lifecycle_receipt_count,
         lifecycle.verifiable_lifecycle_receipt_count,
         lifecycle.retained_purpose_lifecycle_receipt_count,
         lifecycle.current_intent_lifecycle_receipt_count
       FROM active_native_policies active
       JOIN current_purpose_provenance current_purpose
         ON current_purpose.policy_id = active.policy_id
       JOIN lifecycle_source_state lifecycle ON lifecycle.policy_id = active.policy_id
     )
     SELECT
       COUNT(*)::INTEGER AS active_policy_count,
       COUNT(*)::INTEGER AS authoritative_active_native_policy_count,
       COUNT(*) FILTER (
         WHERE intent_version IS NOT NULL
           AND intent_version > 0
       )::INTEGER AS current_intent_version_policy_count,
       COUNT(*) FILTER (
         WHERE intent_version IS NOT NULL
           AND intent_version > 0
           AND schema_version IS NOT NULL
           AND schema_version > 0
       )::INTEGER AS current_intent_schema_version_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
       )::INTEGER AS retained_purpose_policy_count,
       COUNT(*) FILTER (
         WHERE normal_lifecycle_receipt_count > 0
       )::INTEGER AS normal_lifecycle_receipt_policy_count,
       COUNT(*) FILTER (
         WHERE normal_lifecycle_receipt_count > 0
           AND normal_lifecycle_receipt_count = verifiable_lifecycle_receipt_count
       )::INTEGER AS verifiable_lifecycle_receipt_policy_count,
       COUNT(*) FILTER (
         WHERE current_intent_lifecycle_receipt_count > 0
       )::INTEGER AS current_intent_lifecycle_receipt_policy_count,
       COUNT(*) FILTER (
         WHERE intent_version IS NOT NULL
           AND intent_version > 0
           AND schema_version IS NOT NULL
           AND schema_version > 0
           AND specialized_purpose_rule_count > inferred_profile_purpose_rule_count
           AND normal_lifecycle_receipt_count > 0
           AND normal_lifecycle_receipt_count = verifiable_lifecycle_receipt_count
           AND normal_lifecycle_receipt_count = retained_purpose_lifecycle_receipt_count
           AND current_intent_lifecycle_receipt_count > 0
       )::INTEGER AS complete_policy_evidence_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > 0
           AND specialized_purpose_rule_count = inferred_profile_purpose_rule_count
       )::INTEGER AS profile_only_purpose_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
           AND normal_lifecycle_receipt_count > 0
           AND normal_lifecycle_receipt_count = verifiable_lifecycle_receipt_count
           AND normal_lifecycle_receipt_count = retained_purpose_lifecycle_receipt_count
           AND current_intent_lifecycle_receipt_count > 0
       )::INTEGER AS lifecycle_retained_purpose_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
           AND (
             normal_lifecycle_receipt_count = 0
             OR current_intent_lifecycle_receipt_count = 0
           )
       )::INTEGER AS lifecycle_receipt_required_policy_count,
       COUNT(*) FILTER (
         WHERE specialized_purpose_rule_count > inferred_profile_purpose_rule_count
           AND normal_lifecycle_receipt_count > 0
           AND current_intent_lifecycle_receipt_count > 0
           AND NOT (
             normal_lifecycle_receipt_count = verifiable_lifecycle_receipt_count
             AND normal_lifecycle_receipt_count = retained_purpose_lifecycle_receipt_count
           )
       )::INTEGER AS lifecycle_receipt_review_required_policy_count
     FROM evidence_policy_state`,
  );

  return asArray(result)[0] || {};
}
