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
  buildPolicyDeclaredNativePurposeRuleSqlPredicate,
} from './policyDeclaredPurposeProvenance.mjs';
import {
  CONFIRMED_OUTCOME_AUTHORITY_SOURCE,
  CONFIRMED_OUTCOME_SOURCE_SYSTEM,
  MIN_CONFIRMATION_COUNT,
} from './policyNativeIntentConfirmedOutcomePurposeSuggestionPersistence.mjs';

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeMediaType(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ['movie', 'tv'].includes(normalized) ? normalized : null;
}

function toSelectedLibraryContexts(records) {
  const contexts = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const libraryId = asPositiveInteger(record?.library_id);
    const mediaType = normalizeMediaType(record?.library_media_type);
    if (!libraryId || !mediaType) continue;
    contexts.set(`${libraryId}:${mediaType}`, { libraryId, mediaType });
  }
  return [...contexts.values()];
}

function asRows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

/**
 * Compares declared genre terms and repeated, policy-authorized operator
 * outcome evidence inside PostgreSQL. Only library IDs and aggregate counts
 * leave the database; term values and outcome identities remain private.
 */
export async function loadPolicyPurposeOutcomeQualityRecords({ db, records } = {}) {
  const selectedLibraryContexts = toSelectedLibraryContexts(records);
  if (selectedLibraryContexts.length === 0) return [];

  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({ intentAlias: 'intent' });
  const declaredPurposePredicate = buildPolicyDeclaredNativePurposeRuleSqlPredicate({
    ruleAlias: 'rule',
  });
  const result = await db.query(
    `WITH selected_libraries AS (
       SELECT DISTINCT
         selected.library_id,
         LOWER(BTRIM(selected.media_type)) AS media_type
       FROM jsonb_to_recordset($1::jsonb) AS selected(library_id INTEGER, media_type TEXT)
       WHERE selected.library_id > 0
         AND LOWER(BTRIM(selected.media_type)) IN ('movie', 'tv')
     ),
     declared_genre_terms AS (
       SELECT DISTINCT
         selected.library_id,
         selected.media_type,
         LOWER(BTRIM(configured_term.value #>> '{}')) AS term_key
       FROM selected_libraries selected
       JOIN libraries library
         ON library.id = selected.library_id
        AND library.is_active = TRUE
       JOIN library_policies policy
         ON policy.library_id = selected.library_id
        AND policy.enabled = TRUE
       JOIN policy_intents intent
         ON intent.policy_id = policy.id
        AND intent.library_id = selected.library_id
       JOIN policy_intent_rules rule ON rule.intent_id = intent.id
       CROSS JOIN LATERAL (
         SELECT require_all.value
         FROM jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(rule.values -> 'require_all') = 'array'
               THEN rule.values -> 'require_all'
             ELSE '[]'::jsonb
           END
         ) AS require_all(value)
         UNION
         SELECT require_any.value
         FROM jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(rule.values -> 'require_any') = 'array'
               THEN rule.values -> 'require_any'
             ELSE '[]'::jsonb
           END
         ) AS require_any(value)
       ) AS configured_term(value)
       WHERE LOWER(library.media_type) = selected.media_type
         AND ${authorityPredicate}
         AND rule.intent_role = 'purpose'
         AND rule.collection = 'purpose'
         AND rule.semantics = 'identity'
         AND rule.signal_type = 'genres'
         AND ${declaredPurposePredicate}
         AND jsonb_typeof(configured_term.value) = 'string'
         AND BTRIM(configured_term.value #>> '{}') <> ''
     ),
     confirmed_outcome_genre_terms AS (
       SELECT DISTINCT
         evidence.library_id,
         LOWER(evidence.media_type) AS media_type,
         LOWER(BTRIM(SUBSTRING(evidence.evidence_key FROM 7))) AS term_key
       FROM classification_evidence evidence
       JOIN selected_libraries selected
         ON selected.library_id = evidence.library_id
        AND selected.media_type = LOWER(evidence.media_type)
       WHERE evidence.scope = 'genre'
         AND evidence.status = 'active'
         AND evidence.source_system = $2
         AND evidence.evidence_data @> $3::jsonb
         AND evidence.source_classification_id IS NOT NULL
         AND evidence.usage_count >= $4
         AND evidence.evidence_key LIKE 'genre:%'
         AND BTRIM(SUBSTRING(evidence.evidence_key FROM 7)) <> ''
     )
     SELECT
       selected.library_id,
       COUNT(DISTINCT outcome.term_key)::INTEGER AS confirmed_outcome_term_count,
       COUNT(DISTINCT outcome.term_key) FILTER (
         WHERE declared.term_key IS NOT NULL
       )::INTEGER AS declared_purpose_aligned_outcome_term_count
     FROM selected_libraries selected
     LEFT JOIN confirmed_outcome_genre_terms outcome
       ON outcome.library_id = selected.library_id
      AND outcome.media_type = selected.media_type
     LEFT JOIN declared_genre_terms declared
       ON declared.library_id = outcome.library_id
      AND declared.media_type = outcome.media_type
      AND declared.term_key = outcome.term_key
     GROUP BY selected.library_id
     ORDER BY selected.library_id ASC`,
    [
      JSON.stringify(selectedLibraryContexts.map(context => ({
        library_id: context.libraryId,
        media_type: context.mediaType,
      }))),
      CONFIRMED_OUTCOME_SOURCE_SYSTEM,
      JSON.stringify({ authoritySourceId: CONFIRMED_OUTCOME_AUTHORITY_SOURCE }),
      MIN_CONFIRMATION_COUNT - 1,
    ],
  );

  return asRows(result);
}
