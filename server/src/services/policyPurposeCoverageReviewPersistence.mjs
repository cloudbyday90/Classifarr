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

/**
 * Reads current validated native-policy purpose coverage. Required terms are
 * compared only inside PostgreSQL and are never selected into application
 * memory or returned by this report.
 */
export async function loadPolicyPurposeCoverageReviewRecords({ db, limit }) {
  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({
    intentAlias: 'intent',
  });
  const result = await db.query(
    `WITH active_native_policies AS (
       SELECT
         policy.id AS policy_id,
         policy.name AS policy_name,
         policy.library_id,
         library.name AS library_name,
         library.media_type AS library_media_type,
         LOWER(library.media_type) AS normalized_media_type,
         intent.id AS intent_id
       FROM library_policies policy
       JOIN libraries library ON library.id = policy.library_id
       JOIN policy_intents intent
         ON intent.policy_id = policy.id
        AND intent.library_id = policy.library_id
       WHERE policy.enabled = TRUE
         AND library.is_active = TRUE
         AND ${authorityPredicate}
     ),
     required_content_terms AS (
       SELECT DISTINCT
         active.policy_id,
         active.library_id,
         active.normalized_media_type,
         rule.signal_type,
         LOWER(BTRIM(configured_term.term_value #>> '{}')) AS term_key
       FROM active_native_policies active
       JOIN policy_intent_rules rule ON rule.intent_id = active.intent_id
       CROSS JOIN LATERAL (
         SELECT require_all.value AS term_value
         FROM jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(rule.values -> 'require_all') = 'array'
               THEN rule.values -> 'require_all'
             ELSE '[]'::jsonb
           END
         ) AS require_all(value)
         UNION
         SELECT require_any.value AS term_value
         FROM jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(rule.values -> 'require_any') = 'array'
               THEN rule.values -> 'require_any'
             ELSE '[]'::jsonb
           END
         ) AS require_any(value)
       ) configured_term
       WHERE rule.intent_role = 'purpose'
         AND rule.semantics = 'identity'
         AND rule.signal_type IN ('genres', 'keywords', 'studios')
         AND jsonb_typeof(configured_term.term_value) = 'string'
         AND BTRIM(configured_term.term_value #>> '{}') <> ''
     ),
     policy_term_counts AS (
       SELECT
         policy_id,
         COUNT(DISTINCT signal_type)::INTEGER AS required_signal_type_count,
         COUNT(DISTINCT (signal_type, term_key))::INTEGER AS required_term_count
       FROM required_content_terms
       GROUP BY policy_id
     ),
     overlap_counts AS (
       SELECT
         candidate_terms.policy_id,
         COUNT(DISTINCT (candidate_terms.signal_type, candidate_terms.term_key))::INTEGER
           AS shared_required_term_count,
         COUNT(DISTINCT other_terms.library_id)::INTEGER AS overlapping_destination_count
       FROM required_content_terms candidate_terms
       JOIN required_content_terms other_terms
         ON other_terms.normalized_media_type = candidate_terms.normalized_media_type
        AND other_terms.library_id <> candidate_terms.library_id
        AND other_terms.signal_type = candidate_terms.signal_type
        AND other_terms.term_key = candidate_terms.term_key
       GROUP BY candidate_terms.policy_id
     )
     SELECT
       active.policy_id,
       active.policy_name,
       active.library_id,
       active.library_name,
       active.library_media_type,
       COALESCE(term_counts.required_signal_type_count, 0)::INTEGER
         AS required_signal_type_count,
       COALESCE(term_counts.required_term_count, 0)::INTEGER AS required_term_count,
       COALESCE(overlap.shared_required_term_count, 0)::INTEGER
         AS shared_required_term_count,
       COALESCE(overlap.overlapping_destination_count, 0)::INTEGER
         AS overlapping_destination_count
     FROM active_native_policies active
     LEFT JOIN policy_term_counts term_counts ON term_counts.policy_id = active.policy_id
     LEFT JOIN overlap_counts overlap ON overlap.policy_id = active.policy_id
     ORDER BY active.policy_id ASC
     LIMIT $1`,
    [limit],
  );

  return asArray(result);
}
