/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { exactQualityKeys as exact } from './sourcePairQualityContract.mjs';
import { qualityEvidenceTime } from './qualityEvidenceContract.mjs';
import { validSourcePairQualityReport } from './sourcePairQualityReport.mjs';
import { EVALUATION_GAP_REASONS } from './evaluationCoverageGaps.mjs';

export const QUALITY_AUDIT_LIMITS = Object.freeze({ providerCalls: 0, databaseWrites: 0, routingWrites: 0,
  promotionAllowed: false, currentInputsVerified: false });
export const QUALITY_AUDIT_GUIDANCE = Object.freeze({
  upgrade_required: 'Required evaluation schema is unavailable. Verify database access and the installed schema; if missing, install a release containing it through the normal upgrade process, then rerun this audit. No upgrade was performed.',
  study_not_started: 'Save a current frozen protocol, then explicitly start its study. Starting a study does not enable capture.',
  study_expired: 'The study expired. Preserve any existing private reports and prepare a new protocol; do not renew or combine old evidence.',
  invalid_stored_state: 'Stored evidence failed validation. Preserve diagnostics and investigate before restarting; do not treat it as zero coverage.',
  study_inactive: 'This study stopped after drift or conflict. Inspect its historical report and inputs before explicitly replacing it.',
  no_eligible_cases: 'The frozen protocol has no eligible movie/TV cases. Check supported inventory and evidence prerequisites; music remains excluded.',
  blocked_evidence: 'Some pairs have non-cache blockers. Inspect the fixed gap counts and repair their prerequisites before requesting more responses.',
  capture_disabled: 'Some pairs only need cached responses, but recurring capture is disabled. Review existing capture settings separately; this audit does not authorize spending.',
  cohort_gap: 'The stored diagnostic cohort omits study references. Verify exact request coverage before choosing a budget-neutral capture selector; overlap alone does not prove eligibility.',
  awaiting_cache: 'Some pairs only need cached responses. Inspect existing capture progress and allowance; no new capture or budget increase is authorized.',
  review_required: 'Obtain independent, protocol-bound reference labels, resolve disagreements, and rerun with the reference file. Do not use predictions or placement as ground truth.',
  synthetic_reference: 'These references are synthetic. Use them for software validation only, not a real-world quality claim.',
  report_available: 'A historical comparison is available. Review its limits and independent provenance; this is not routing or promotion approval.',
});
export function qualityAuditStatus(value) {
  if (Object.values(value.capabilities).some(available => !available)) return 'upgrade_required';
  if (value.studyState === 'not_started') return 'study_not_started';
  if (value.studyState === 'expired') return 'study_expired';
  if (value.studyState === 'invalid') return 'invalid_stored_state';
  if (value.studyState !== 'active') return 'study_inactive';
  if (!value.quality.total.sampled) return 'no_eligible_cases';
  if (value.coverage.total.blocked) return 'blocked_evidence';
  if (value.coverage.total.cacheBackfillOnly) {
    if (value.captureDailyCalls === 0) return 'capture_disabled';
    if (value.storedCohortOverlap?.studyOnly > 0) return 'cohort_gap';
    return 'awaiting_cache';
  }
  if (value.quality.provenance === 'synthetic_fixture.v1') return 'synthetic_reference';
  return value.quality.status === 'measured' ? 'report_available' : 'review_required';
}
const count = (value, max = 300) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const coverage = value => exact(value, ['sampled', 'paired', 'cacheBackfillOnly', 'blocked']) &&
  Object.values(value).every(n => count(n)) && value.sampled === value.paired + value.cacheBackfillOnly + value.blocked;

/** No free-form source/provider content, request identities, or library identifiers may escape. */
export function validQualityCoverageAudit(value) {
  if (!exact(value, ['version', 'observedAt', 'capabilities', 'studyState', 'expiresAt', 'quality', 'coverage', 'gaps',
    'uniqueMissingRequests', 'storedCohortOverlap', 'captureDailyCalls', 'cache', 'status', 'guidance', 'limits']) ||
    value.version !== 'quality_coverage_audit.v1' || !qualityEvidenceTime(value.observedAt) ||
    !exact(value.capabilities, ['study', 'cache', 'evaluation', 'budget']) || Object.values(value.capabilities).some(v => typeof v !== 'boolean') ||
    !['unavailable', 'not_started', 'expired', 'invalid', 'active', 'drifted', 'conflicted'].includes(value.studyState) ||
    value.expiresAt !== null && !qualityEvidenceTime(value.expiresAt) ||
    value.captureDailyCalls !== null && !count(value.captureDailyCalls, 200) ||
    !exact(value.limits, Object.keys(QUALITY_AUDIT_LIMITS)) || Object.entries(QUALITY_AUDIT_LIMITS).some(([key, expected]) => value.limits[key] !== expected)) return false;
  const installed = Object.values(value.capabilities).every(Boolean);
  if (!installed && value.studyState !== 'unavailable' || installed && value.studyState === 'unavailable') return false;
  if (!installed && (value.cache !== null || value.captureDailyCalls !== null) ||
      ['unavailable', 'not_started', 'invalid'].includes(value.studyState) && value.expiresAt !== null ||
      installed && value.cache === null) return false;
  if (['active', 'drifted', 'conflicted'].includes(value.studyState) && (!value.expiresAt || value.expiresAt <= value.observedAt) ||
      value.studyState === 'expired' && (!value.expiresAt || value.expiresAt > value.observedAt)) return false;
  if (value.cache !== null && (!exact(value.cache, ['state', 'responses']) || !['missing', 'current', 'expired', 'invalid'].includes(value.cache.state) ||
      (['missing', 'invalid'].includes(value.cache.state) ? value.cache.responses !== null : !count(value.cache.responses, 50)))) return false;
  if (['active', 'drifted', 'conflicted'].includes(value.studyState)) {
    if (!validSourcePairQualityReport(value.quality) || value.quality.version !== 'source_pair_quality_report.v2' ||
      !exact(value.coverage, ['total', 'movie', 'tv']) || !Object.values(value.coverage).every(coverage) ||
      !exact(value.gaps, EVALUATION_GAP_REASONS) || !Object.values(value.gaps).every(n => count(n, 600)) ||
      !count(value.uniqueMissingRequests, value.gaps.cache_missing) || value.expiresAt === null) return false;
    for (const [key, slice] of Object.entries(value.coverage)) {
      const quality = key === 'total' ? value.quality.total : value.quality.byMedia[key];
      if (slice.sampled !== quality.sampled || slice.paired !== quality.paired) return false;
    }
    if (Object.keys(value.coverage.total).some(key => value.coverage.total[key] !== value.coverage.movie[key] + value.coverage.tv[key]) ||
        Object.values(value.gaps).reduce((a, b) => a + b, 0) !== 2 * value.quality.total.sampled - value.quality.total.baseline.completed - value.quality.total.sourceAware.completed) return false;
    if (value.storedCohortOverlap !== null && (!exact(value.storedCohortOverlap, ['shared', 'studyOnly', 'diagnosticOnly']) ||
      !Object.values(value.storedCohortOverlap).every(n => count(n)) || value.storedCohortOverlap.shared + value.storedCohortOverlap.studyOnly !== value.quality.total.sampled ||
      value.storedCohortOverlap.shared + value.storedCohortOverlap.diagnosticOnly > 300)) return false;
  } else if ([value.quality, value.coverage, value.gaps, value.uniqueMissingRequests, value.storedCohortOverlap].some(v => v !== null)) return false;
  return value.status === qualityAuditStatus(value) && value.guidance === QUALITY_AUDIT_GUIDANCE[value.status];
}
