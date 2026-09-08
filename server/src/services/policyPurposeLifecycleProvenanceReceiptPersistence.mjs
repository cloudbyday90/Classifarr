/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
  const result = await db.query(
    `WITH initial_lifecycle_receipts AS (
       SELECT
         establishment.intent_id,
         establishment.policy_id,
         1::INTEGER AS expected_intent_version,
         establishment.established_at AS occurred_at,
         establishment.id AS receipt_id,
         'initial_intent_establishment'::TEXT AS lifecycle_transition
       FROM policy_initial_intent_establishments establishment
       WHERE establishment.state = 'established'
         AND establishment.intent_id IS NOT NULL
       ORDER BY establishment.established_at DESC NULLS LAST, establishment.id DESC
       LIMIT $1
     ),
     change_lifecycle_receipts AS (
       SELECT
         change_receipt.target_intent_id AS intent_id,
         change_receipt.policy_id,
         change_receipt.target_intent_version AS expected_intent_version,
         change_receipt.created_at AS occurred_at,
         change_receipt.id AS receipt_id,
         'native_intent_change'::TEXT AS lifecycle_transition
       FROM policy_native_intent_change_receipts change_receipt
       WHERE change_receipt.result_status_id = 'applied'
       ORDER BY change_receipt.created_at DESC, change_receipt.id DESC
       LIMIT $1
     ),
     normal_lifecycle_receipts AS (
       SELECT * FROM initial_lifecycle_receipts

       UNION ALL

       SELECT * FROM change_lifecycle_receipts
     ),
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
           WHERE rule.source = 'media_server_library_profile'
             AND rule.inference_state = 'inferred'
         )::INTEGER AS inferred_profile_purpose_rule_count
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
       inferred_profile_purpose_rule_count
     FROM receipt_provenance_counts`,
    [limit],
  );

  return asArray(result);
}
