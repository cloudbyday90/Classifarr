/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const PURPOSE_OUTCOME_GAPS = ['missing_capture', 'legacy_capture', 'expired_capture', 'capture_gap',
  'invalid_capture', 'unverified_purpose', 'no_policy_leader', 'source_only_identity', 'binding_failure', 'legacy_event'];

export const PURPOSE_EVALUATION_VERSION = 'purpose_evaluation.v1';
export const PURPOSE_EVALUATION_MAX_REPORT_BYTES = 16384;
export const PURPOSE_EVALUATION_GAPS = Object.freeze([...PURPOSE_OUTCOME_GAPS, 'missing_action_evidence', 'selection_only', 'unknown_action',
  'missing_supplement', 'expired', 'conflicting', 'unavailable_destination']);
export const PURPOSE_EVALUATION_FAILURES = Object.freeze(['busy', 'memory_pressure', 'memory_unknown', 'evidence_budget',
  'invalid_evidence', 'deadline', 'sources_unavailable', 'evaluation_unavailable']);
export const PURPOSE_EVALUATION_DEFERRALS = Object.freeze(['busy', 'memory_pressure', 'memory_unknown']);
export const PURPOSE_COMPARISONS = Object.freeze(['policyVersusChoice', 'originalVersusChoice', 'policyVersusOriginal']);
export const PURPOSE_ACTIONS = Object.freeze(['confirmation', 'correction']);
export const PURPOSE_SOURCES = Object.freeze(['manual', 'runtime', 'history_review']);
export const PURPOSE_ORIGINAL_STATES = Object.freeze(['available', 'not_captured', 'not_completed', 'not_automated']);
export const PURPOSE_EVALUATION_LIMITS = Object.freeze({ retentionDays: 30, inputEvents: 5000, inputBytes: 67108864,
  reportBytes: 16384, producerReadiness: 'not_assessed', agreementIsNotAccuracy: true, comparisonsOverlap: true, confirmationsMayBeSuggestionBiased: true,
  placementsAreNotLabels: true, providerCalls: 0, sourceWrites: 0, routingChanges: 0, learningChanges: 0 });
export const purposeExact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const purposeTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const count = (value, max = 5000) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const sum = values => values.reduce((a, b) => a + b, 0);
export const purposeEvaluationPhase = (sourceRows, eligible) => !sourceRows ? 'no_retained_choices' : eligible ? 'diagnostic_only' : 'no_eligible_choices';
function validComparisons(value, eligible) {
  return purposeExact(value, PURPOSE_COMPARISONS) && PURPOSE_COMPARISONS.every(key => purposeExact(value[key], ['agrees', 'differs', 'unavailable']) &&
    Object.values(value[key]).every(n => count(n, eligible)) && sum(Object.values(value[key])) === eligible) &&
    value.policyVersusChoice.unavailable === 0 && value.originalVersusChoice.unavailable === value.policyVersusOriginal.unavailable;
}
function validGroups(groups, keys, report) {
  return purposeExact(groups, keys) && keys.every(key => purposeExact(groups[key], ['eligible', 'comparisons']) &&
    count(groups[key].eligible, report.eligible) && validComparisons(groups[key].comparisons, groups[key].eligible)) &&
    sum(keys.map(key => groups[key].eligible)) === report.eligible && PURPOSE_COMPARISONS.every(comparison =>
      ['agrees', 'differs', 'unavailable'].every(status => sum(keys.map(key => groups[key].comparisons[comparison][status])) === report.comparisons[comparison][status]));
}

/** Closed aggregate only. No IDs, hashes, item data or inference from current configuration are admitted. */
export function readPurposeEvaluationReport(value) {
  if (!purposeExact(value, ['version', 'window', 'phase', 'eligible', 'comparisons', 'cohorts', 'sources', 'originalEvidence', 'coverage', 'limits']) ||
      value.version !== PURPOSE_EVALUATION_VERSION || !purposeExact(value.window, ['since', 'until']) || !Object.values(value.window).every(purposeTime) ||
      Date.parse(value.window.until) - Date.parse(value.window.since) !== 30 * 86400000 || !count(value.eligible) ||
      !validComparisons(value.comparisons, value.eligible) || !validGroups(value.cohorts, PURPOSE_ACTIONS, value) ||
      !validGroups(value.sources, PURPOSE_SOURCES, value) || !purposeExact(value.originalEvidence, PURPOSE_ORIGINAL_STATES) ||
      !Object.values(value.originalEvidence).every(n => count(n, value.eligible)) || sum(Object.values(value.originalEvidence)) !== value.eligible ||
      value.originalEvidence.available !== value.eligible - value.comparisons.originalVersusChoice.unavailable ||
      !purposeExact(value.coverage, ['sourceRows', 'canonicalEvents', 'aliases', 'duplicateItems', 'gaps', 'observedGaps'])) return null;
  const c = value.coverage;
  if (![c.sourceRows, c.canonicalEvents, c.aliases, c.duplicateItems].every(n => count(n)) || c.canonicalEvents > c.sourceRows ||
      c.aliases !== c.sourceRows - c.canonicalEvents || ![c.gaps, c.observedGaps].every(gaps => purposeExact(gaps, PURPOSE_EVALUATION_GAPS) &&
        Object.values(gaps).every(n => count(n, c.canonicalEvents))) || sum(Object.values(c.gaps)) + c.duplicateItems + value.eligible !== c.canonicalEvents ||
      sum(Object.values(c.observedGaps)) > c.canonicalEvents || PURPOSE_EVALUATION_GAPS.some(key => c.observedGaps[key] < c.gaps[key]) ||
      value.phase !== purposeEvaluationPhase(c.sourceRows, value.eligible) || !purposeExact(value.limits, Object.keys(PURPOSE_EVALUATION_LIMITS)) ||
      !Object.entries(PURPOSE_EVALUATION_LIMITS).every(([key, expected]) => value.limits[key] === expected) ||
      JSON.stringify(value).length > PURPOSE_EVALUATION_MAX_REPORT_BYTES) return null;
  return value;
}
