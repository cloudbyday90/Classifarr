/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { purposeCohortRow, purposeCohortInput, PURPOSE_COHORT_NOW } from '../fixtures/purposeOutcomeFixture.mjs';
import { purposePolicyContextFixture, purposePolicyContextInput } from '../fixtures/purposePolicyContextFixture.mjs';
import { buildPurposeOutcomeCaseReport } from '../../services/purposeOutcomeCaseReport.mjs';
import { buildPurposeOutcomeCohortReport } from '../../services/purposeOutcomeCohortReport.mjs';
import { validPolicyEvaluationCapture } from '../../services/policyEvaluationCaptureContract.mjs';
import { runInventoryOutcomeCalibration } from '../../scripts/runInventoryOutcomeCalibration.mjs';
import { readPurposePolicyContextInputs } from '../../services/purposePolicyContextRepository.mjs';

const enabled = { includePolicyContext: true };
const report = (rows, captures) => buildPurposeOutcomeCaseReport(purposePolicyContextInput(rows, captures), enabled);

test.each(['movie', 'tv'])('opt-in %s context binds exact BIGINT identity and preserves independent score/order meanings', mediaType => {
  const row = purposeCohortRow({ destination: 5, classificationId: '9223372036854775807', mediaType });
  const record = purposePolicyContextFixture(row, 2), leader = record.payload.ranked[0];
  record.payload.candidates[0].rawScore = 3; record.payload.candidates[0].scores.intent = 2;
  const input = purposePolicyContextInput([row], [record]), ordinary = buildPurposeOutcomeCaseReport(input);
  const result = buildPurposeOutcomeCaseReport(input, enabled), context = result.cases[0].policyEvaluation;
  expect(result.version).toBe('policy.purpose_outcome_cases.v2');
  expect(context).toMatchObject({ status: 'available', version: 'policy_evaluation.v2', reference: 'retained_policy_evaluation',
    identityKey: `${mediaType}:42`, candidates: [{ rawScore: 3 }, { purposeEvidence: null }], ranked: [leader, record.payload.ranked[1]] });
  expect(context.candidates.map(candidate => candidate.libraryId)).toEqual([4, 4]);
  expect(result.policyEvaluationCoverage).toMatchObject({ eligible: 1, available: 1 });
  expect(JSON.stringify(result.evaluation)).toBe(JSON.stringify(ordinary.evaluation));
  expect(result.comparisonCohorts).toEqual(ordinary.comparisonCohorts);
  expect(result.cases[0].comparisons).toEqual(ordinary.cases[0].comparisons);
  expect(result.interpretation.selectedPolicyNotEstablished).toBe(true);
  context.candidates[0].scores.intent = 99; expect(record.payload.candidates[0].scores.intent).toBe(2);
});

test.each([
  ['missing', () => null],
  ['legacy_capture', value => { value.version = 1; return value; }],
  ['expired', value => { value.observedMicros = String(BigInt(value.observedMicros) - 30n * 86400000000n);
    value.expiresMicros = String(BigInt(value.expiresMicros) - 30n * 86400000000n); value.payload = null; value.payloadBytes = null; return value; }],
  ['pool_overflow', value => { value.reasonId = 'pool_overflow'; value.payload = null; value.payloadBytes = null; return value; }],
  ['payload_overflow', value => { value.payloadBytes = 65537; value.payload = null; return value; }],
  ['binding_failure', value => { value.classificationId = '2'; return value; }],
  ['leader_mismatch', value => { value.payload.ranked[0].score++; return value; }],
  ['capture_invalid', value => { value.payload.candidates[0].raw = 'PRIVATE'; return value; }],
])('%s context stays an optional gap without changing case eligibility or measurements', (reason, mutate) => {
  const row = purposeCohortRow({ destination: 5 }), result = report([row], [mutate(purposePolicyContextFixture(row))]);
  expect(result.cases[0].policyEvaluation).toEqual({ status: 'unavailable', reason });
  expect(result.policyEvaluationCoverage.gaps[reason]).toBe(1);
  expect(result.evaluation).toEqual(buildPurposeOutcomeCohortReport(purposeCohortInput([row])));
  expect(result.display.flaggedCases).toBe(1); expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each(['headerType', 'headerIdentity', 'payloadIdentity', 'headerTime', 'payloadTime', 'lease', 'future', 'microseconds', 'version',
  'expiredAt', 'extraHeader', 'proof', 'leaderId', 'leaderLibrary', 'missingLeader', 'unprovedLeader', 'payloadVersion', 'count', 'exclusions'])('rejects %s drift as a diagnostic gap', kind => {
  const row = purposeCohortRow({ destination: 5 }), value = purposePolicyContextFixture(row);
  if (kind === 'headerType') value.mediaType = 'tv';
  if (kind === 'headerIdentity') value.identityKey = 'movie:43';
  if (kind === 'payloadIdentity') value.payload.identityKey = 'movie:43';
  if (kind === 'headerTime') { value.observedMicros = String(BigInt(value.observedMicros) + 1000n); value.expiresMicros = String(BigInt(value.expiresMicros) + 1000n); }
  if (kind === 'payloadTime') value.payload.capturedAt = '2026-10-29T09:00:01.000Z';
  if (kind === 'lease') value.expiresMicros = String(BigInt(value.expiresMicros) + 1000n);
  if (kind === 'future') { value.observedMicros = String(BigInt(value.observedMicros) + 86400000000n); value.expiresMicros = String(BigInt(value.expiresMicros) + 86400000000n); }
  if (kind === 'microseconds') { value.observedMicros = String(BigInt(value.observedMicros) + 1n); value.expiresMicros = String(BigInt(value.expiresMicros) + 1n); }
  if (kind === 'version') value.version = 3;
  if (kind === 'expiredAt') value.expiredAt = PURPOSE_COHORT_NOW;
  if (kind === 'extraHeader') value.extra = 'PRIVATE';
  if (kind === 'proof') value.payload.candidates[0].purposeEvidence.specificity = 'insufficient_specialized_evidence';
  if (kind === 'leaderId') { value.payload.candidates[0].policyId++; value.payload.ranked[0].policyId++; }
  if (kind === 'leaderLibrary') { value.payload.candidates[0].libraryId++; value.payload.ranked[0].libraryId++; }
  if (kind === 'missingLeader') { value.payload.ranked = []; value.payload.candidates[0].disposition = 'ranking_excluded'; value.payload.exclusions.ranking_excluded = 1; }
  if (kind === 'unprovedLeader') value.payload.candidates[0].purposeEvidence = null;
  if (kind === 'payloadVersion') value.payload.version = 'policy_evaluation.v1';
  if (kind === 'count') value.payload.policyCount++;
  if (kind === 'exclusions') value.payload.exclusions.non_comparable++;
  const result = report([row], [value]);
  expect(result.cases[0].policyEvaluation.status).toBe('unavailable');
  expect(result.evaluation.sampleSize).toBe(1); expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test('complete sixty-four-candidate pools trigger whole-case byte omission after full-window coverage', () => {
  const rows = Array.from({ length: 60 }, (_, i) => purposeCohortRow({ classificationId: String(i + 1), tmdbId: i + 1, destination: 5 }));
  const captures = rows.map(row => purposePolicyContextFixture(row, 64));
  expect(captures.every(value => validPolicyEvaluationCapture(value.payload))).toBe(true);
  const result = report(rows, captures);
  expect(result.policyEvaluationCoverage.available).toBe(60);
  expect(result.display.shownCases).toBeGreaterThan(0); expect(result.display.shownCases).toBeLessThan(50);
  expect(result.display.omittedCases).toBe(60 - result.cases.length); expect(result.display.truncated).toBe(true);
  expect(result.cases.map(item => Number(item.classificationId))).toEqual(Array.from({ length: result.cases.length }, (_, i) => i + 1));
  expect(result.cases.every(item => item.policyEvaluation.candidates.length === 64)).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1048576);
  captures.at(-1).payload.candidates[0].name = 'PRIVATE';
  expect(report(rows, captures).policyEvaluationCoverage.gaps.capture_invalid).toBe(1);
});

test('full context cannot repair a supplement gap or release a later favorable retry', () => {
  const first = purposeCohortRow(), later = purposeCohortRow({ classificationId: '2', destination: 5, at: '2026-10-29T11:00:00.000Z' });
  const captures = [purposePolicyContextFixture(first), purposePolicyContextFixture(later)]; first.supplement = null;
  const result = report([later, first], captures.toReversed());
  expect(result.cases).toEqual([]); expect(result.policyEvaluationCoverage).toMatchObject({ eligible: 0, available: 0 });
  expect(result.evaluation.coverage).toMatchObject({ duplicateItems: 1, gaps: { missing_supplement: 1 } });
});

test('unflagged eligible events contribute context coverage without exposing item details', () => {
  const result = report([purposeCohortRow()]);
  expect(result.cases).toEqual([]); expect(result.policyEvaluationCoverage).toMatchObject({ eligible: 1, available: 1 });
  expect(JSON.stringify(result)).not.toMatch(/"tmdbId"|"policyId"|"libraryId"/);
});

test('ordinary reports ignore even malformed optional input and preserve their original protocol', () => {
  const row = purposeCohortRow({ destination: 5 }), input = { ...purposeCohortInput([row]), policyContextInputs: 'PRIVATE' };
  expect(JSON.stringify(buildPurposeOutcomeCaseReport(input))).toBe(JSON.stringify(buildPurposeOutcomeCaseReport(purposeCohortInput([row]))));
  expect(() => buildPurposeOutcomeCaseReport(input, enabled)).toThrow('purpose_context_invalid_input');
});

function runtimeFixture(rows = [purposeCohortRow({ destination: 5 })]) {
  const captureRows = rows.map(row => ({ classificationId: row.classification_id, capture: purposePolicyContextFixture(row) }));
  const runtime = { close: jest.fn(), withTransaction: jest.fn(async callback => callback(runtime.client)),
    client: { query: jest.fn(async sql => sql.startsWith('SELECT date_trunc') ? { rows: [{ observed_at: PURPOSE_COHORT_NOW }] } :
      sql.startsWith('WITH authorized') ? { rows: rows.map(input => ({ input, events: rows.length, payload_bytes: '4000' })) } :
        sql.startsWith('WITH requested') ? { rows: captureRows.map(input => ({ input, captures: rows.length, payload_bytes: '6000' })) } : { rows: [] }) } };
  return runtime;
}
test('CLI modifier selects the additional read in the same transaction with only the remaining combined budget', async () => {
  const runtime = runtimeFixture(), result = await runInventoryOutcomeCalibration({ argv: ['--prospective-purpose-cases', '--include-policy-context'], load: async () => runtime });
  expect(result.policyEvaluationCoverage.available).toBe(1); expect(runtime.withTransaction).toHaveBeenCalledTimes(1);
  expect(runtime.withTransaction.mock.calls[0][1]).toMatchObject({ readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 15000 });
  expect(runtime.client.query.mock.calls.at(-1)[1]).toEqual([['1'], PURPOSE_COHORT_NOW, 67108864 - 4000]);
  expect(runtime.close).toHaveBeenCalledTimes(1);
  const ordinary = runtimeFixture(); await runInventoryOutcomeCalibration({ argv: ['--prospective-purpose-cases'], load: async () => ordinary });
  expect(ordinary.client.query).toHaveBeenCalledTimes(3);
});
test.each(['', '--prospective-purpose', '--prospective-disagreements', '--prospective'])('rejects context outside purpose cases before runtime load: %s', async mode => {
  const load = jest.fn();
  await expect(runInventoryOutcomeCalibration({ argv: [mode, '--include-policy-context'].filter(Boolean), load })).rejects.toThrow('mode_options');
  expect(load).not.toHaveBeenCalled();
});
test.each(['overflow', 'foreign', 'duplicate', 'missing'])('context %s admission fails without partial output and closes runtime', async kind => {
  const runtime = runtimeFixture(), query = runtime.client.query.getMockImplementation();
  runtime.client.query.mockImplementation(async (...args) => {
    const result = await query(...args);
    if (args[0].startsWith('WITH requested')) {
      if (kind === 'overflow') result.rows[0].payload_bytes = '67108864';
      if (kind === 'foreign') result.rows[0].input.classificationId = '2';
      if (kind === 'duplicate') result.rows.push(result.rows[0]);
      if (kind === 'missing') result.rows[0].input = null;
    }
    return result;
  });
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-purpose-cases', '--include-policy-context'], load: async () => runtime })).rejects.toThrow('purpose_context_');
  expect(runtime.close).toHaveBeenCalledTimes(1);
});
test('context query rejects invalid requested IDs before executing SQL', async () => {
  const client = { query: jest.fn() };
  await expect(readPurposePolicyContextInputs(client, { rows: [{ classification_id: '9223372036854775808' }] }, 1)).rejects.toThrow('invalid_input');
  expect(client.query).not.toHaveBeenCalled();
});

test('multiple source aliases fetch the exact BIGINT classification context once', async () => {
  const id = '9223372036854775807', client = { query: jest.fn(async () => ({ rows: [
    { captures: 1, payload_bytes: '100', input: { classificationId: id, capture: null } },
  ] })) };
  const contexts = await readPurposePolicyContextInputs(client, { observedAt: PURPOSE_COHORT_NOW,
    rows: [{ classification_id: id }, { classification_id: id }] }, 100);
  expect(client.query.mock.calls[0][1][0]).toEqual([id]);
  expect(contexts.size).toBe(1); expect(contexts.get(id)).toBeNull();
});
