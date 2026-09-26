/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { exactQualityKeys } from './sourcePairQualityContract.mjs';
import { qualityWilsonInterval } from './sourcePairQualityMetrics.mjs';

export const QUALITY_LIMITS = Object.freeze({ providerCalls: 0, routingWrites: 0, promotionAllowed: false, independenceVerified: false,
  populationAccuracy: null, intervalScope: 'conditional_binomial_not_population', snapshotScope: 'frozen_at_start', currentModelVerified: false });
const count = (value, max = 300) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const sameInterval = (value, correct, total) => {
  const expected = qualityWilsonInterval(correct, total);
  return expected === null ? value === null : exactQualityKeys(value, ['lower', 'upper']) &&
    value.lower === expected.lower && value.upper === expected.upper;
};
function validSlice(value, sampled, paired) {
  if (!exactQualityKeys(value, ['labels', 'paired', 'unpaired', 'gains', 'regressions', 'netCorrectShare', 'baseline', 'sourceAware']) ||
      !['labels', 'paired', 'unpaired', 'gains', 'regressions'].every(key => count(value[key])) ||
      value.labels > sampled || value.paired > paired || value.paired + value.unpaired !== value.labels ||
      value.gains + value.regressions > value.paired || value.netCorrectShare !== (value.paired ? (value.gains - value.regressions) / value.paired : null)) return false;
  if (!['baseline', 'sourceAware'].every(name => {
    const arm = value[name];
    return exactQualityKeys(arm, ['correct', 'wrong', 'abstained', 'correctShare', 'wrongAmongDecisions']) &&
      ['correct', 'wrong', 'abstained'].every(key => count(arm[key])) && arm.correct + arm.wrong + arm.abstained === value.paired &&
      sameInterval(arm.correctShare, arm.correct, value.paired) && sameInterval(arm.wrongAmongDecisions, arm.wrong, arm.correct + arm.wrong);
  })) return false;
  return value.sourceAware.correct - value.baseline.correct === value.gains - value.regressions;
}
function validCoverage(value) {
  return exactQualityKeys(value, ['sampled', 'paired', 'missingLabels', 'conflictingLabels', 'independent', 'corrections', 'baseline', 'sourceAware']) &&
    ['sampled', 'paired', 'missingLabels', 'conflictingLabels'].every(key => count(value[key])) && value.paired <= value.sampled &&
    validSlice(value.independent, value.sampled, value.paired) && validSlice(value.corrections, value.sampled, value.paired) &&
    value.missingLabels + value.conflictingLabels + value.independent.labels === value.sampled &&
    ['baseline', 'sourceAware'].every(name => {
      const arm = value[name];
      return exactQualityKeys(arm, ['completed', 'abstained', 'cacheMissing', 'blocked']) && Object.values(arm).every(n => count(n)) &&
        arm.completed + arm.cacheMissing + arm.blocked === value.sampled && arm.abstained <= arm.completed && value.paired <= arm.completed;
    });
}
function sumsMatch(total, movie, tv) {
  return Object.keys(total).every(key => ['netCorrectShare', 'correctShare', 'wrongAmongDecisions'].includes(key) ||
    (typeof total[key] === 'object' ? sumsMatch(total[key], movie[key], tv[key]) : total[key] === movie[key] + tv[key]));
}

/** Strict worker egress allowlist: no titles, destinations, prompts, paths or responses. */
export function validSourcePairQualityReport(value) {
  if (!exactQualityKeys(value, ['version', 'protocolId', 'cacheRevision', 'status', 'provenance', 'total', 'byMedia', 'usage', 'limits']) ||
      !['source_pair_quality_report.v1', 'source_pair_quality_report.v2'].includes(value.version) || ![value.protocolId, value.cacheRevision].every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)) ||
      !['no_eligible_cases', 'insufficient_reference_labels', 'synthetic_only', 'incomplete_evidence', 'partial_reference_coverage', 'measured'].includes(value.status) ||
      !['none', 'independent_human.v1', 'synthetic_fixture.v1'].includes(value.provenance) || !validCoverage(value.total) ||
      !exactQualityKeys(value.byMedia, ['movie', 'tv']) || !Object.values(value.byMedia).every(validCoverage) ||
      !sumsMatch(value.total, value.byMedia.movie, value.byMedia.tv) || !exactQualityKeys(value.limits, Object.keys(QUALITY_LIMITS)) ||
      Object.entries(QUALITY_LIMITS).some(([key, expected]) => value.limits[key] !== expected) ||
      !exactQualityKeys(value.usage, ['uniqueCachedResponses', 'historicalPromptTokens', 'historicalOutputTokens', 'historicalLatencyMs'])) return false;
  const usage = value.usage;
  if (!count(usage.uniqueCachedResponses, value.version === 'source_pair_quality_report.v2' ? 600 : 50) || !count(usage.historicalPromptTokens, usage.uniqueCachedResponses * 8192) ||
      !count(usage.historicalOutputTokens, usage.uniqueCachedResponses * 256) || !count(usage.historicalLatencyMs, usage.uniqueCachedResponses * 600000)) return false;
  const expected = !value.total.sampled ? 'no_eligible_cases' : !value.total.independent.labels ? 'insufficient_reference_labels'
    : value.provenance === 'synthetic_fixture.v1' ? 'synthetic_only' : value.total.independent.unpaired ? 'incomplete_evidence'
      : value.total.independent.labels < value.total.sampled ? 'partial_reference_coverage' : 'measured';
  return value.status === expected && (value.provenance !== 'none' || value.total.independent.labels === 0);
}
