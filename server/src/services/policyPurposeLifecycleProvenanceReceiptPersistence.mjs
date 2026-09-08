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
  buildPolicyPurposeLifecycleReceiptSourceCtesSql,
} from './policyPurposeLifecycleReceiptSources.mjs';
import {
  buildPolicyDeclaredNativePurposeRuleSqlPredicate,
  buildPolicyProfileDerivedPurposeRuleSqlPredicate,
} from './policyDeclaredPurposeProvenance.mjs';

function asArray(value) {
  return Array.isArray(value?.rows) ? value.rows : [];
}

/**
 * Reads a bounded window of durable normal-policy lifecycle receipts. It only
 * returns receipt transition names, revision resolvability, and aggregate
 * specialized-purpose provenance counts. Rule values, policy identifiers,
 * receipt identifiers, timestamps, actor data, and media data stay in SQL.
 */
export async function loadPolicyPurposeLifecycleProvenanceReceiptRecords({ db, limit }) {
  const declaredNativePurposePredicate = buildPolicyDeclaredNativePurposeRuleSqlPredicate();
  const profileDerivedPurposePredicate = buildPolicyProfileDerivedPurposeRuleSqlPredicate();
  const result = await db.query(
    `WITH ${buildPolicyPurposeLifecycleReceiptSourceCtesSql({
      scope: 'recent-receipt-window',
    })},
     bounded_receipts AS (
       SELECT *
       FROM normal_lifecycle_receipts
       ORDER BY occurred_at DESC NULLS LAST, lifecycle_transition ASC, receipt_id DESC
       LIMIT $1
     ),
     receipt_provenance_counts AS (
       SELECT
         receipt.lifecycle_transition,
         (intent.id IS NOT NULL) AS intent_available,
         COUNT(rule.id)::INTEGER AS specialized_purpose_rule_count,
         COUNT(rule.id) FILTER (
           WHERE ${profileDerivedPurposePredicate}
         )::INTEGER AS inferred_profile_purpose_rule_count,
         COUNT(rule.id) FILTER (
           WHERE ${declaredNativePurposePredicate}
         )::INTEGER AS declared_native_purpose_rule_count
       FROM bounded_receipts receipt
       LEFT JOIN policy_intents intent
         ON intent.id = receipt.intent_id
        AND intent.policy_id = receipt.policy_id
        AND intent.intent_version = receipt.expected_intent_version
        AND intent.source = 'native_intent'
       LEFT JOIN policy_intent_rules rule
         ON rule.intent_id = intent.id
        AND rule.intent_role = 'purpose'
        AND rule.semantics = 'identity'
        AND rule.signal_type IN ('genres', 'keywords', 'studios')
       GROUP BY receipt.lifecycle_transition, receipt.receipt_id, intent.id
     )
     SELECT
       lifecycle_transition,
       intent_available,
       specialized_purpose_rule_count,
       inferred_profile_purpose_rule_count,
       declared_native_purpose_rule_count
     FROM receipt_provenance_counts`,
    [limit],
  );

  return asArray(result);
}
