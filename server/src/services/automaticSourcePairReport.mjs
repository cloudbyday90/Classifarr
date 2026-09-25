/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createSourceDescriptionMetrics, finishSourceDescriptionMetrics } from './sourceDescriptionEvaluationMetrics.mjs';
import { readAutomaticPolicyReport } from './automaticPolicyReplayReport.mjs';
import { readCachedAdjudicationReport } from './cachedAdjudicationReport.mjs';

const metrics = finishSourceDescriptionMetrics(createSourceDescriptionMetrics());
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 50000;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const enums = {
  status: ['complete', 'cache_incomplete', 'no_eligible_cases'],
  qualityStatus: ['not_evaluated', 'correction_cohort_measured', 'no_correction_labels'],
  cohortReason: ['created', 'reused', 'source_changed', 'expired'],
};
const limits = Object.freeze({ scope: 'retrieval_shortlist_ablation', independentBlindLabels: 0,
  fullPipelineAccuracy: null, unknownIdentityAliasesExcluded: false, promotionAllowed: false,
  providerCalls: 0, routingWrites: 0 });
const coverage = { movie: 0, tv: 0, sourceOnly: 0, tmdbLinked: 0, eligibleIdentities: 0,
  missingCachedDescriptions: 0, correctionLabels: 0, libraries: 0, sampledLibraries: 0 };
const template = { version: 'automatic_source_pair.v1', evaluator: 'source_description_pair_v2',
  status: '', qualityStatus: '', cohortReason: '', snapshotFingerprint: '', sampleFingerprint: '',
  requested: 300, sampled: 0, sampleShortfall: 0, durationMs: 0, coverage,
  metrics, byMedia: { movie: metrics, tv: metrics }, byQueryIdentity: { source_only: metrics, tmdb_linked: metrics }, limits };

function matches(value, expected, key = '') {
  if (Object.hasOwn(enums, key)) return enums[key].includes(value);
  if (['snapshotFingerprint', 'sampleFingerprint'].includes(key)) return hash(value);
  if (key === 'durationMs') return Number.isSafeInteger(value) && value >= 0 && value <= 120000;
  if (expected === null) return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
  if (typeof expected === 'number') return key === 'requested' ? value === 300 : count(value);
  if (typeof expected !== 'object') return value === expected;
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === Object.keys(expected).length && Object.entries(expected)
      .every(([name, entry]) => Object.hasOwn(value, name) && matches(value[name], entry, name));
}

function validMetrics(value) {
  if (value.cases > 300 || value.correctionCases > value.cases || value.changedShortlists > value.cases ||
    value.changedLeaders > value.cases || value.candidateGains + value.candidateRegressions > value.correctionCases ||
    value.leadingGains + value.leadingRegressions > value.correctionCases) return false;
  const rate = (a, b) => b ? Number((a / b).toFixed(6)) : null;
  return [value.baseline, value.sourceAware].every(arm => arm.noEvidence <= value.cases &&
    arm.candidateHits <= value.correctionCases && arm.leadingMatches + arm.leadingMismatches <= value.correctionCases &&
    arm.labeledProposals === arm.leadingMatches + arm.leadingMismatches &&
    Object.values(arm.correctionOutcomes).reduce((sum, n) => sum + n, 0) === value.correctionCases &&
    arm.candidateRecallAt3 === rate(arm.candidateHits, value.correctionCases) &&
    arm.leadingProposalMismatchRate === rate(arm.leadingMismatches, arm.labeledProposals));
}

/** Exact bounded aggregate: no content, model names, per-item hashes or library identifiers. */
export function readAutomaticSourcePairReport(value) {
  if (value?.version === 'automatic_source_pair.v3') {
    const { aiReplay, ...policy } = value;
    return readAutomaticSourcePairReport({ ...policy, version: 'automatic_source_pair.v2' }) &&
      readCachedAdjudicationReport(aiReplay, value.sampled) &&
      aiReplay.labeledPairs <= value.policyReplay.eligibleLabels &&
      ['baseline', 'sourceAware'].every(arm => aiReplay[arm].labeledProposals <= value.policyReplay.eligibleLabels) &&
      (value.policyReplay.status === 'complete' || aiReplay.eligible === 0) ? value : null;
  }
  if (value?.version === 'automatic_source_pair.v2') {
    const { policyReplay, ...retrieval } = value;
    return readAutomaticSourcePairReport({ ...retrieval, version: 'automatic_source_pair.v1' }) &&
      readAutomaticPolicyReport(policyReplay, value.sampled) &&
      (value.status === 'complete' ? ['complete', 'no_policies'].includes(policyReplay.status) : policyReplay.status === value.status) &&
      (policyReplay.status !== 'complete' || ['movie', 'tv'].every(type => policyReplay.byMedia[type].cases === value.coverage[type])) ? value : null;
  }
  if (!value || !matches(value, { ...template, ...(value.status !== 'complete'
    ? { metrics: null, byMedia: null, byQueryIdentity: null } : {}) }) ||
    Object.entries(limits).some(([key, entry]) => value.limits[key] !== entry) || value.sampled > 300 ||
    value.sampleShortfall !== 300 - value.sampled || value.coverage.movie + value.coverage.tv !== value.sampled ||
    value.coverage.sourceOnly + value.coverage.tmdbLinked !== value.sampled ||
    (value.status !== 'complete' && [value.metrics, value.byMedia, value.byQueryIdentity].some(entry => entry !== null)) ||
    (value.status === 'complete' && (value.metrics.cases !== value.sampled || value.sampled === 0 ||
      ![value.metrics, ...Object.values(value.byMedia), ...Object.values(value.byQueryIdentity)].every(validMetrics) ||
      value.byMedia.movie.cases !== value.coverage.movie || value.byMedia.tv.cases !== value.coverage.tv ||
      value.byQueryIdentity.source_only.cases !== value.coverage.sourceOnly ||
      value.byQueryIdentity.tmdb_linked.cases !== value.coverage.tmdbLinked))) return null;
  return value;
}

export function projectAutomaticSourcePairReport(report, cohortReason, durationMs) {
  const value = { version: template.version, evaluator: report.version, status: report.status, qualityStatus: report.qualityStatus,
    cohortReason, snapshotFingerprint: report.snapshotFingerprint, sampleFingerprint: report.sampleFingerprint,
    requested: report.requested, sampled: report.sampled, sampleShortfall: report.sampleShortfall, durationMs,
    coverage: { movie: report.sampleCoverage.byMedia.movie, tv: report.sampleCoverage.byMedia.tv,
      sourceOnly: report.sampleCoverage.byQueryIdentity.source_only, tmdbLinked: report.sampleCoverage.byQueryIdentity.tmdb_linked,
      eligibleIdentities: report.coverage.eligibleIdentities, missingCachedDescriptions: report.coverage.missingCachedDescriptions,
      correctionLabels: report.coverage.correctionLabels, libraries: report.sampleCoverage.libraries.length,
      sampledLibraries: report.sampleCoverage.libraries.filter(row => row.sampled > 0).length },
    metrics: report.metrics, byMedia: report.byMedia, byQueryIdentity: report.byQueryIdentity, limits: { ...limits } };
  if (!readAutomaticSourcePairReport(value)) throw new Error('automatic_source_pair_report_invalid');
  return value;
}
