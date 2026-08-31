/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function asRows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

/**
 * Loads a selected policy's evidence metadata. Queries deliberately select no
 * media titles, rule values, profile payloads, event IDs, or fingerprints.
 */
export async function loadPolicyScopedEvidenceDigestContext({ db, policyId, since }) {
  const policyResult = await db.query(
    `SELECT
       policy.id,
       policy.name,
       policy.library_id,
       library.name AS library_name,
       library.media_type AS library_media_type
     FROM library_policies policy
     JOIN libraries library ON library.id = policy.library_id
     WHERE policy.id = $1
     LIMIT 1`,
    [policyId],
  );
  const policy = asRows(policyResult)[0] || null;
  if (!policy) return null;

  const [activeIntentsResult, observedProfileResult, admittedHistoryResult] = await Promise.all([
    db.query(
      `SELECT
         intent.id,
         intent.source,
         intent.inference_state,
         intent.validation_status,
         intent.intent_version,
         (
           SELECT COUNT(*)::INTEGER
           FROM policy_intent_rules purpose_rule
           WHERE purpose_rule.intent_id = intent.id
             AND purpose_rule.intent_role = 'purpose'
         ) AS purpose_rule_count,
         (
           SELECT COALESCE(array_agg(DISTINCT purpose_rule.signal_type), '{}')
           FROM policy_intent_rules purpose_rule
           WHERE purpose_rule.intent_id = intent.id
             AND purpose_rule.intent_role = 'purpose'
         ) AS purpose_signal_types
       FROM policy_intents intent
       WHERE intent.policy_id = $1
         AND intent.active = TRUE
       ORDER BY intent.intent_version DESC, intent.id DESC
       LIMIT 2`,
      [policyId],
    ),
    db.query(
      `SELECT
         source_id,
         capture_state,
         capture_reason_id,
         profile_freshness_state,
         expires_at,
         created_at,
         payload_redacted
       FROM policy_observed_evidence_provenance_snapshots
       WHERE policy_id = $1
         AND library_id = $2
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [policyId, policy.library_id],
    ),
    db.query(
      `SELECT
         signal_type,
         COUNT(*)::INTEGER AS admission_count,
         MAX(created_at) AS latest_admission_at
       FROM policy_identity_evidence_admissions
       WHERE authority_policy_id = $1
         AND library_id = $2
         AND created_at >= $3
       GROUP BY signal_type
       ORDER BY signal_type ASC`,
      [policyId, policy.library_id, since],
    ),
  ]);

  return {
    policy,
    activeIntents: asRows(activeIntentsResult),
    observedProfile: asRows(observedProfileResult)[0] || null,
    admittedHistory: asRows(admittedHistoryResult),
  };
}
