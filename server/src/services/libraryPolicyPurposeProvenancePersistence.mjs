/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildNativeIntentAuthoritySqlPredicate } from './policyNativeIntentAuthorityEligibility.mjs';

const SELECTED_LIBRARY_LIMIT = 12;

function normalizeLibraryIds(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .filter((libraryId) => Number.isSafeInteger(libraryId) && libraryId > 0 && libraryId <= 2147483647))]
    .slice(0, SELECTED_LIBRARY_LIMIT);
}

/**
 * Reads fixed policy-purpose provenance counts for the already bounded library
 * selection. It never selects rule values, policy names, profile observations,
 * or media data.
 */
export async function loadLibraryPolicyPurposeProvenanceRecords({ db, libraryIds } = {}) {
  const selectedLibraryIds = normalizeLibraryIds(libraryIds);
  if (!selectedLibraryIds.length) return [];

  const authorityPredicate = buildNativeIntentAuthoritySqlPredicate({ intentAlias: 'intent' });
  const result = await db.query(
    `WITH selected_libraries AS MATERIALIZED (
       SELECT UNNEST($1::INTEGER[]) AS library_id
     ),
     active_native_policies AS (
       SELECT selected.library_id, policy.id AS policy_id, intent.id AS intent_id
       FROM selected_libraries selected
       JOIN libraries library ON library.id = selected.library_id
        AND library.is_active = TRUE
       JOIN library_policies policy ON policy.library_id = library.id
        AND policy.enabled = TRUE
       JOIN policy_intents intent ON intent.policy_id = policy.id
        AND intent.library_id = library.id
       WHERE ${authorityPredicate}
     ),
     specialized_purpose_provenance_counts AS (
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
     )
     SELECT
       selected.library_id,
       COUNT(active.policy_id)::INTEGER AS active_validated_policy_count,
       COUNT(active.policy_id) FILTER (
         WHERE provenance.specialized_purpose_rule_count > 0
           AND provenance.specialized_purpose_rule_count
             = provenance.inferred_profile_purpose_rule_count
       )::INTEGER AS profile_only_specialized_purpose_policy_count,
       COUNT(active.policy_id) FILTER (
         WHERE provenance.specialized_purpose_rule_count
           > provenance.inferred_profile_purpose_rule_count
       )::INTEGER AS retained_declared_purpose_policy_count
     FROM selected_libraries selected
     LEFT JOIN active_native_policies active ON active.library_id = selected.library_id
     LEFT JOIN specialized_purpose_provenance_counts provenance
       ON provenance.policy_id = active.policy_id
     GROUP BY selected.library_id
     ORDER BY selected.library_id ASC`,
    [selectedLibraryIds],
  );

  return Array.isArray(result?.rows) ? result.rows : [];
}
