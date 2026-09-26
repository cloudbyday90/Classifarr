/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validQualityProtocol } from './sourcePairQualityContract.mjs';
import { validQualityEvidence } from './qualityEvidenceContract.mjs';
import { reportQualityEvidence } from './qualityEvidenceReport.mjs';
import { EVALUATION_GAP_REASONS } from './evaluationCoverageGaps.mjs';
import { validSourcePairCohort } from './automaticSourcePairCohort.mjs';
import { QUALITY_AUDIT_GUIDANCE, QUALITY_AUDIT_LIMITS, qualityAuditStatus, validQualityCoverageAudit } from './qualityCoverageAuditContract.mjs';

const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const counts = () => ({ sampled: 0, paired: 0, cacheBackfillOnly: 0, blocked: 0 });
function cacheSummary(cache, now) {
  if (!cache) return { state: 'missing', responses: null };
  const created = time(cache.captured_at), expires = time(cache.expires_at);
  if (!created || !expires || created > now || expires <= created || !Number.isInteger(cache.responses) || cache.responses < 0 || cache.responses > 50) return { state: 'invalid', responses: null };
  return { state: expires <= now ? 'expired' : 'current', responses: cache.responses };
}
function addCoverage(result, study, diagnostic) {
  const coverage = { total: counts(), movie: counts(), tv: counts() }, gaps = Object.fromEntries(EVALUATION_GAP_REASONS.map(gap => [gap, 0])), missing = new Set();
  for (const row of study.evidence.cases) {
    const pending = row.arms.filter(arm => arm.gap !== 'none');
    const category = !pending.length ? 'paired' : pending.every(arm => arm.status === 'misses') ? 'cacheBackfillOnly' : 'blocked';
    for (const slice of [coverage.total, coverage[row.mediaType]]) { slice.sampled++; slice[category]++; }
    for (const arm of pending) { gaps[arm.gap]++; if (arm.status === 'misses') missing.add(arm.requestKey); }
  }
  Object.assign(result, { coverage, gaps, uniqueMissingRequests: missing.size });
  const created = time(diagnostic?.cohort_created_at), age = Date.parse(result.observedAt) - Date.parse(created);
  if (created && age >= 0 && age < 720 * 3600000 && validSourcePairCohort(diagnostic?.cohort)) {
    const cohort = new Set(diagnostic.cohort), shared = study.protocol.cohort.filter(key => cohort.has(key)).length;
    result.storedCohortOverlap = { shared, studyOnly: study.protocol.cohort.length - shared, diagnosticOnly: cohort.size - shared };
  }
}

/** Stored evidence audit only: no source snapshot, replay worker, provider or promotion capability. */
export function buildQualityCoverageAudit({ observedAt, capabilities, study = null, budget = null, cache = null, diagnostic = null }, reference = null) {
  const result = { version: 'quality_coverage_audit.v1', observedAt: time(observedAt), capabilities,
    studyState: 'unavailable', expiresAt: null, quality: null, coverage: null, gaps: null, uniqueMissingRequests: null,
    storedCohortOverlap: null, captureDailyCalls: null, cache: null, status: '', guidance: '', limits: { ...QUALITY_AUDIT_LIMITS } };
  if (Object.values(capabilities).every(Boolean)) {
    result.captureDailyCalls = budget === null ? 0 : Number.isInteger(budget.daily_calls) && budget.daily_calls >= 0 && budget.daily_calls <= 200 ? budget.daily_calls : null;
    result.cache = cacheSummary(cache, result.observedAt);
    result.studyState = study === null ? 'not_started' : 'invalid';
    if (study && validQualityProtocol(study.protocol) && study.protocol_id === study.protocol.id && validQualityEvidence(study.evidence, study.protocol) &&
        ['active', 'drifted', 'conflicted'].includes(study.status) && time(study.created_at) === study.protocol.createdAt &&
        time(study.expires_at) === new Date(Date.parse(study.protocol.createdAt) + 720 * 3600000).toISOString() &&
        study.protocol.createdAt <= result.observedAt && study.evidence.observedAt <= result.observedAt) {
      result.expiresAt = time(study.expires_at);
      result.studyState = result.expiresAt <= result.observedAt ? 'expired' : study.status;
      if (result.studyState !== 'expired') {
        result.quality = reportQualityEvidence(study.evidence, study.protocol, reference);
        addCoverage(result, study, diagnostic);
      }
    }
  }
  result.status = qualityAuditStatus(result); result.guidance = QUALITY_AUDIT_GUIDANCE[result.status];
  if (!validQualityCoverageAudit(result)) throw new Error('quality_audit_invalid');
  return result;
}
