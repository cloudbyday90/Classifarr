/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Current scoring-source edit times, captured beside labels in one read snapshot. */
export const OPERATOR_POLICY_SOURCE_REVISION_SQL = `
  SELECT lp.id AS policy_id, library.media_type,
    GREATEST(lp.created_at, lp.updated_at,
      (SELECT MAX(GREATEST(intent.created_at, intent.updated_at, intent.accepted_at))
       FROM policy_intents intent WHERE intent.policy_id = lp.id AND intent.active IS TRUE),
      (SELECT MAX(rule.created_at) FROM policy_intent_rules rule
       JOIN policy_intents intent ON intent.id = rule.intent_id
       WHERE intent.policy_id = lp.id AND intent.active IS TRUE),
      (SELECT MAX(link.applied_at) FROM policy_intent_template_applications link
       JOIN policy_intents intent ON intent.id = link.intent_id
       WHERE intent.policy_id = lp.id AND intent.active IS TRUE),
      (SELECT MAX(GREATEST(attachment.created_at, preset.created_at, preset.updated_at))
       FROM policy_presets attachment JOIN content_presets preset ON preset.id = attachment.preset_id
       WHERE attachment.policy_id = lp.id)) AS source_updated_at,
    (EXISTS(SELECT 1 FROM policy_presets WHERE policy_id = lp.id)
      OR EXISTS(SELECT 1 FROM policy_intent_template_applications link
        JOIN policy_intents intent ON intent.id = link.intent_id
        WHERE intent.policy_id = lp.id AND intent.active IS TRUE)) AS mutable_attachment
  FROM library_policies lp JOIN libraries library ON library.id = lp.library_id
  WHERE lp.enabled IS TRUE AND library.is_active IS TRUE
  ORDER BY lp.id
`;

const timestamp = value => {
  const millis = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(millis) ? millis : null;
};

/** Temporal separation is necessary, not proof of blind or independent labels. */
export function screenCorrectionsAfterPolicySources({ corrections, feedbackRows, policies, policySourceRevisionRows }) {
  if (!(corrections instanceof Map) || !Array.isArray(feedbackRows) || !Array.isArray(policies) ||
      !Array.isArray(policySourceRevisionRows)) throw new Error('operator_policy_provenance_unavailable');
  const expected = new Map(policies.map(policy => [policy.id, policy.library_media_type]));
  const actual = new Map(policySourceRevisionRows.map(row => [row.policy_id, row.media_type]));
  if (!expected.size || expected.size !== policies.length || actual.size !== expected.size ||
      policySourceRevisionRows.length !== actual.size || [...expected].some(([id, mediaType]) =>
        !['movie', 'tv'].includes(mediaType) || actual.get(id) !== mediaType)) {
    throw new Error('operator_policy_provenance_mismatch');
  }
  const byMedia = new Map();
  for (const row of policySourceRevisionRows) {
    if (!byMedia.has(row.media_type)) byMedia.set(row.media_type, { latest: -Infinity, unverifiable: false });
    const state = byMedia.get(row.media_type), revision = timestamp(row.source_updated_at);
    state.unverifiable ||= revision === null || row.mutable_attachment !== false;
    if (revision !== null) state.latest = Math.max(state.latest, revision);
  }
  const observations = new Map();
  for (const row of feedbackRows) {
    const key = `${row?.media_type}:${row?.tmdb_id}`;
    if (!corrections.has(key)) continue;
    if (!observations.has(key)) observations.set(key, []);
    observations.get(key).push(timestamp(row.observed_at));
  }
  const eligible = new Map();
  const coverage = { correctedIdentities: corrections.size, afterPolicySources: 0,
    beforeOrAtPolicySourceEdit: 0, missingObservationTime: 0, unverifiablePolicySources: 0,
    noActivePolicyForMedia: 0 };
  for (const [key, label] of corrections) {
    const times = observations.get(key) ?? [];
    const source = byMedia.get(key.split(':', 1)[0]);
    if (!times.length || times.some(value => value === null)) coverage.missingObservationTime++;
    else if (!source) coverage.noActivePolicyForMedia++;
    else if (source.unverifiable) coverage.unverifiablePolicySources++;
    else if (times.some(value => value <= source.latest)) coverage.beforeOrAtPolicySourceEdit++;
    else { eligible.set(key, label); coverage.afterPolicySources++; }
  }
  return { corrections: eligible, coverage, temporalPolicySeparationOnly: true };
}
