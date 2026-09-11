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
         policy.name AS policy_name,
         policy.library_id,
         library.name AS library_name,
         library.media_type AS library_media_type,
         intent.id AS intent_id,
         intent.intent_version
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
 * Reads bounded active policy rows and their current purpose rules only for a
 * server-side equality reduction. The caller must discard the rule collection
 * after building its redacted worklist response.
 */
export async function loadPolicyPurposeDeclarationWorklistRecords({ db, limit }) {
  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({
    intentAlias: 'intent',
  });
  const result = await db.query(
    `WITH active_native_policies AS (
       ${buildActiveNativePoliciesSql(authorityPredicate)}
     )
     SELECT
       active.policy_id,
       active.policy_name,
       active.library_id,
       active.library_name,
       active.library_media_type,
       active.intent_version,
       COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'signal_type', rule.signal_type,
             'operator', rule.operator,
             'values', rule.values,
             'constraint_mode', rule.constraint_mode,
             'semantics', rule.semantics,
             'source', rule.source,
             'inference_state', rule.inference_state
           )
           ORDER BY rule.sort_order, rule.id
         ) FILTER (WHERE rule.id IS NOT NULL),
         '[]'::jsonb
       ) AS purpose_rules
     FROM active_native_policies active
     LEFT JOIN policy_intent_rules rule
       ON rule.intent_id = active.intent_id
      AND rule.intent_role = 'purpose'
      AND rule.collection = 'purpose'
     GROUP BY
       active.policy_id,
       active.policy_name,
       active.library_id,
       active.library_name,
       active.library_media_type,
       active.intent_version
     ORDER BY active.policy_id ASC
     LIMIT $1`,
    [limit],
  );

  return asArray(result);
}
