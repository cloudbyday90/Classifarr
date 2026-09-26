/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { qualitySnapshot, qualityReferences } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { emptyQualityEvidence } from '../../services/qualityEvidenceContract.mjs';
import { qualityHash } from '../../services/sourcePairQualityContract.mjs';
import { buildQualityCoverageAudit } from '../../services/qualityCoverageAudit.mjs';
import { validQualityCoverageAudit } from '../../services/qualityCoverageAuditContract.mjs';
import { qualityAuditCapabilities } from '../../services/qualityCoverageAuditRepository.mjs';

const capabilities = { study: true, cache: true, evaluation: true, budget: true };
function fixture(count = 48) {
  const protocol = prepareSourcePairQualityProtocol(qualitySnapshot(count)).protocol;
  const study = { protocol_id: protocol.id, protocol, evidence: emptyQualityEvidence(protocol), status: 'active',
    created_at: protocol.createdAt, expires_at: new Date(Date.parse(protocol.createdAt) + 720 * 3600000).toISOString() };
  return { observedAt: protocol.createdAt, capabilities: { ...capabilities }, study,
    budget: { daily_calls: 20 }, diagnostic: { cohort: protocol.cohort, cohort_created_at: protocol.createdAt } };
}
function complete(input) {
  for (const row of input.study.evidence.cases) row.arms = [0, 1].map(() => ({ status: 'automatic',
    target: input.study.protocol.destinations.find(target => target.mediaType === row.mediaType).target,
    gap: 'none', requestKey: null, responseHash: null }));
  return input;
}
const missing = () => ({ status: 'misses', gap: 'cache_missing', target: null, requestKey: qualityHash('shared request'), responseHash: null });

test('missing schema is unavailable, never fabricated zero coverage', () => {
  const input = fixture(); input.capabilities.study = false;
  const result = buildQualityCoverageAudit(input);
  expect(result).toMatchObject({ status: 'upgrade_required', studyState: 'unavailable', coverage: null, quality: null,
    limits: { providerCalls: 0, databaseWrites: 0, routingWrites: 0, promotionAllowed: false, currentInputsVerified: false } });
  expect(validQualityCoverageAudit(result)).toBe(true);
  expect(qualityAuditCapabilities([])).toEqual({ study: false, cache: false, evaluation: false, budget: false });
});

test('300-case audit partitions blocked/missing/paired cases and deduplicates shared requests', () => {
  const input = complete(fixture(400));
  input.study.evidence.cases[0].arms = [missing(), missing()];
  input.study.evidence.cases[1].arms = [missing(), { status: 'unavailable', gap: 'configuration_unavailable', target: null, requestKey: null, responseHash: null }];
  const result = buildQualityCoverageAudit(input);
  expect(result).toMatchObject({ status: 'blocked_evidence', coverage: { total: { sampled: 300, paired: 298, cacheBackfillOnly: 1, blocked: 1 } },
    gaps: { cache_missing: 3, configuration_unavailable: 1 }, uniqueMissingRequests: 1,
    storedCohortOverlap: { shared: 300, studyOnly: 0, diagnosticOnly: 0 } });
  expect(result.coverage.movie.sampled + result.coverage.tv.sampled).toBe(300);
  expect(validQualityCoverageAudit(result)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|requestKey|responseHash|destinationId|library_id|title|overview/);
});

test.each([
  ['study_not_started', input => { input.study = null; }],
  ['study_expired', input => { input.observedAt = input.study.expires_at; }],
  ['invalid_stored_state', input => { input.study.evidence.secret = 'PRIVATE'; }],
  ['invalid_stored_state', input => { input.study.created_at = 'invalid'; }],
  ['invalid_stored_state', input => { input.study.evidence.observedAt = '2026-09-26T12:00:00.000Z'; }],
  ['study_inactive', input => { input.study.status = 'drifted'; }],
  ['study_inactive', input => { input.study.status = 'conflicted'; }],
  ['capture_disabled', input => { input.study.evidence.cases[0].arms = [missing(), missing()]; input.budget = null; }],
  ['cohort_gap', input => { input.study.evidence.cases[0].arms = [missing(), missing()]; input.diagnostic.cohort = [qualityHash('different cohort')]; }],
  ['awaiting_cache', input => { input.study.evidence.cases[0].arms = [missing(), missing()]; }],
  ['review_required', () => {}],
])('%s produces a fixed actionable result', (status, mutate) => {
  const input = complete(fixture()); mutate(input);
  const result = buildQualityCoverageAudit(input); expect(result.status).toBe(status);
  expect(result.guidance.length).toBeGreaterThan(25); expect(validQualityCoverageAudit(result)).toBe(true);
});

test('synthetic and declared independent labels never become current-input or promotion verification', () => {
  const input = complete(fixture());
  expect(buildQualityCoverageAudit(input, qualityReferences(input.study.protocol)).status).toBe('synthetic_reference');
  const reference = qualityReferences(input.study.protocol, 'independent_human.v1');
  const result = buildQualityCoverageAudit(input, reference);
  expect(result.status).toBe('report_available'); expect(result.quality.limits.independenceVerified).toBe(false);
  reference.labels.pop(); expect(buildQualityCoverageAudit(input, reference).status).toBe('review_required');
});

test.each(['bad', '2020-01-01', '2030-01-01'])('unusable diagnostic timestamp %s gives unknown overlap, not a selector recommendation', created => {
  const input = fixture(); input.diagnostic.cohort_created_at = created;
  expect(buildQualityCoverageAudit(input).storedCohortOverlap).toBeNull();
});

test.each([
  ['missing', null],
  ['current', { captured_at: '2026-09-25', expires_at: '2026-09-26', responses: 25 }],
  ['expired', { captured_at: '2026-09-23', expires_at: '2026-09-24', responses: 25 }],
  ['invalid', { captured_at: '2026-09-25', expires_at: '2026-09-26', responses: 51 }],
])('cache metadata is %s without reading generated content', (state, cache) => {
  const result = buildQualityCoverageAudit({ ...fixture(), cache });
  expect(result.cache.state).toBe(state); expect(validQualityCoverageAudit(result)).toBe(true);
});

test.each([
  result => { result.private = 'forbidden'; }, result => { result.limits.databaseWrites = 1; },
  result => { result.guidance = 'untrusted provider text'; }, result => { result.coverage.total.paired++; },
  result => { result.gaps.unknown++; }, result => { result.uniqueMissingRequests = 601; },
  result => { result.storedCohortOverlap.shared++; }, result => { result.cache.responses = 51; },
  result => { result.expiresAt = result.observedAt; }, result => { result.capabilities.study = 'true'; },
])('strict output rejects altered receipt (%#)', mutate => {
  const result = buildQualityCoverageAudit(fixture()); mutate(result); expect(validQualityCoverageAudit(result)).toBe(false);
});

test('empty supported cohort is explicit; malformed allowance and timestamps never imply readiness', () => {
  const input = fixture(0);
  expect(buildQualityCoverageAudit(input).status).toBe('no_eligible_cases');
  input.budget.daily_calls = 201;
  expect(buildQualityCoverageAudit(input).captureDailyCalls).toBeNull();
  input.observedAt = 'invalid';
  expect(() => buildQualityCoverageAudit(input)).toThrow('quality_audit_invalid');
});

test('unavailable or absent study cannot carry fabricated cache, expiry, or budget information', () => {
  const result = buildQualityCoverageAudit({ ...fixture(), capabilities: { ...capabilities, study: false } });
  for (const patch of [{ captureDailyCalls: 10 }, { cache: { state: 'missing', responses: null } }, { expiresAt: fixture().study.expires_at }]) {
    expect(validQualityCoverageAudit({ ...result, ...patch })).toBe(false);
  }
  const absent = buildQualityCoverageAudit({ ...fixture(), study: null });
  expect(validQualityCoverageAudit({ ...absent, cache: null })).toBe(false);
});
