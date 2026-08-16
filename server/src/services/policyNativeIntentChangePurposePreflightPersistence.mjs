/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { buildNativeIntentAuthority } from './policyNativeIntentAuthority.mjs';
import { buildNativeIntentAuthoritySqlPredicate } from './policyNativeIntentAuthorityEligibility.mjs';

function firstRow(result) {
  return Array.isArray(result?.rows) ? result.rows[0] || null : null;
}

/**
 * Reads the policy and its active native authority without a lock. The later
 * write endpoint remains responsible for the transaction lock and compare-
 * and-swap revision check; this read only binds advisory output to a revision.
 */
export async function loadPolicyNativeIntentChangePurposePreflightContext({ db, policyId }) {
  const policyResult = await db.query(
    `SELECT
       policy.id AS policy_id,
       policy.name AS policy_name,
       library.id AS library_id,
       library.name AS library_name,
       library.media_type AS library_media_type
     FROM library_policies policy
     JOIN libraries library ON library.id = policy.library_id
     WHERE policy.id = $1
     LIMIT 1`,
    [policyId],
  );
  const policy = firstRow(policyResult);
  if (!policy) return null;

  const intentsResult = await db.query(
    `SELECT
       intent.id,
       intent.policy_id,
       intent.library_id,
       intent.intent_version,
       intent.source,
       intent.inference_state,
       intent.validation_status,
       (
         SELECT COUNT(*)::INTEGER
         FROM policy_intent_rules purpose_rule
         WHERE purpose_rule.intent_id = intent.id
           AND purpose_rule.intent_role = 'purpose'
       ) AS purpose_rule_count
     FROM policy_intents intent
     WHERE intent.policy_id = $1
       AND intent.library_id = $2
       AND intent.active = TRUE
     ORDER BY intent.intent_version DESC, intent.id DESC
     LIMIT 2`,
    [policy.policy_id, policy.library_id],
  );
  const activeIntents = Array.isArray(intentsResult?.rows) ? intentsResult.rows : [];
  const authority = buildNativeIntentAuthority({ activeIntents });

  return {
    ...policy,
    authority,
    activeIntent: authority.authoritative === true ? activeIntents[0] || null : null,
  };
}

function normalizeCandidateTerms(candidateTerms = []) {
  const termsByKey = new Map();
  for (const candidate of Array.isArray(candidateTerms) ? candidateTerms : []) {
    const signalType = typeof candidate?.signalType === 'string' ? candidate.signalType.trim() : '';
    const termKey = typeof candidate?.termKey === 'string' ? candidate.termKey.trim().toLowerCase() : '';
    if (!['genres', 'keywords', 'studios'].includes(signalType) || !termKey) continue;
    termsByKey.set(`${signalType}\u0000${termKey}`, { signal_type: signalType, term_key: termKey });
  }
  return [...termsByKey.values()];
}

/**
 * Compares transient proposed terms inside PostgreSQL. It returns aggregate
 * counts only and never selects either the command's terms or stored terms.
 */
export async function loadPolicyNativeIntentChangePurposePreflightOverlap({
  db,
  candidateTerms,
  libraryId,
  mediaType,
}) {
  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({ intentAlias: 'intent' });
  const normalizedTerms = normalizeCandidateTerms(candidateTerms);
  const result = await db.query(
    `WITH candidate_terms AS (
       SELECT DISTINCT
         candidate.signal_type,
         LOWER(BTRIM(candidate.term_key)) AS term_key
       FROM jsonb_to_recordset($1::jsonb) AS candidate(signal_type TEXT, term_key TEXT)
       WHERE candidate.signal_type IN ('genres', 'keywords', 'studios')
         AND BTRIM(candidate.term_key) <> ''
     ),
     active_native_terms AS (
       SELECT DISTINCT
         policy.library_id,
         rule.signal_type,
         LOWER(BTRIM(configured_term.term_value #>> '{}')) AS term_key
       FROM library_policies policy
       JOIN libraries library ON library.id = policy.library_id
       JOIN policy_intents intent
         ON intent.policy_id = policy.id
        AND intent.library_id = policy.library_id
       JOIN policy_intent_rules rule ON rule.intent_id = intent.id
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
       WHERE policy.enabled = TRUE
         AND library.is_active = TRUE
         AND policy.library_id <> $2
         AND LOWER(library.media_type) = LOWER($3)
         AND ${authorityPredicate}
         AND rule.intent_role = 'purpose'
         AND rule.semantics = 'identity'
         AND rule.signal_type IN ('genres', 'keywords', 'studios')
         AND jsonb_typeof(configured_term.term_value) = 'string'
         AND BTRIM(configured_term.term_value #>> '{}') <> ''
     ),
     shared_terms AS (
       SELECT candidate.signal_type, candidate.term_key
       FROM candidate_terms candidate
       JOIN active_native_terms active
         ON active.signal_type = candidate.signal_type
        AND active.term_key = candidate.term_key
       GROUP BY candidate.signal_type, candidate.term_key
     )
     SELECT
       (SELECT COUNT(DISTINCT signal_type)::INTEGER FROM candidate_terms)
         AS required_signal_type_count,
       (SELECT COUNT(*)::INTEGER FROM candidate_terms) AS required_term_count,
       (SELECT COUNT(*)::INTEGER FROM shared_terms) AS shared_required_term_count,
       (
         SELECT COUNT(DISTINCT active.library_id)::INTEGER
         FROM active_native_terms active
         JOIN shared_terms shared
           ON shared.signal_type = active.signal_type
          AND shared.term_key = active.term_key
       ) AS overlapping_destination_count`,
    [JSON.stringify(normalizedTerms), libraryId, mediaType],
  );

  return firstRow(result) || {
    required_signal_type_count: 0,
    required_term_count: 0,
    shared_required_term_count: 0,
    overlapping_destination_count: 0,
  };
}
