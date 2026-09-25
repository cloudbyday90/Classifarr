/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { EVALUATION_GAP_REASONS, evaluationArmGap, validEvaluationGaps } from '../../services/evaluationCoverageGaps.mjs';
import { evaluationHistoryFixture } from '../fixtures/evaluationHistoryFixture.mjs';
import { validEvaluationHistory } from '../../services/evaluationHistoryContract.mjs';
import { projectEvaluationHistory } from '../../services/evaluationHistorySummary.mjs';
import { adjudicationDigest } from '../../services/cachedAdjudicationContract.mjs';
import { createCachedAdjudicationReport, addCachedAdjudicationPair, readCachedAdjudicationReport } from '../../services/cachedAdjudicationReport.mjs';

const row = result => ({ observed_at: '2026-09-25T12:00:00Z', result });
const summary = results => projectEvaluationHistory(results.map(row)).groups[0];
test.each([
  ['proposed', 'none'], ['abstained', 'none'], ['misses', 'cache_missing'],
  ['output_limited', 'output_limited'], ['context_limit_suspected', 'context_limited'],
  ['malformed', 'invalid_response'], ['PRIVATE token', 'invalid_response'], ['unavailable', 'unknown'],
])('categorizes %s without retaining raw content', (status, reason) => {
  expect(evaluationArmGap({ status, response: 'PRIVATE', gap: 'PRIVATE' })).toBe(reason);
});

test.each(EVALUATION_GAP_REASONS)('validates and counts bounded %s diagnoses exactly once per distinct item', gap => {
  const history = evaluationHistoryFixture({ status: 'unavailable', gap });
  expect(validEvaluationHistory(history)).toBe(true);
  const result = summary([history, history]);
  expect(result.gaps[gap]).toBe(25);
  expect(Object.values(result.gaps).reduce((a, b) => a + b, 0)).toBe(result.selected - result.paired);
});

test('latest cause wins, blocking cause precedes cache miss, completed historical pairs stay completed', () => {
  const misses = evaluationHistoryFixture({ status: 'misses' });
  const invalid = evaluationHistoryFixture({ status: 'malformed' });
  invalid.cases.forEach(entry => { entry.gaps[1] = 'cache_missing'; });
  expect(summary([invalid, misses]).gaps.invalid_response).toBe(25);
  expect(summary([misses, invalid]).gaps.cache_missing).toBe(25);
  const recovered = evaluationHistoryFixture({ labeled: false });
  expect(summary([misses, recovered, invalid])).toMatchObject({ paired: 25, labeled: 0 });
  expect(Object.values(summary([misses, recovered, invalid]).gaps).every(count => count === 0)).toBe(true);
});

test('legacy histories keep completion, but never acquire invented diagnoses', () => {
  const history = evaluationHistoryFixture({ status: 'misses' });
  history.version = 'evaluation_history.v1';
  history.revision = adjudicationDigest([history.version, history.cohortRevision, history.evidenceRevision, history.modelRevision]);
  history.cases.forEach(entry => { delete entry.gaps; });
  expect(validEvaluationHistory(history)).toBe(true);
  expect(summary([history]).gaps).toMatchObject({ unknown: 25, cache_missing: 0 });
  expect(projectEvaluationHistory([row(history), row(evaluationHistoryFixture())]).revisions).toBe(2);
});

test.each([null, [], ['none'], ['none', 'none'], ['PRIVATE', 'cache_missing'], ['misses', 'none'], ['none', 'none', 'none']])(
  'rejects malformed or contradictory incomplete-arm gaps %j', gaps => {
    const history = evaluationHistoryFixture({ status: 'misses' }); history.cases[0].gaps = gaps;
    expect(validEvaluationHistory(history)).toBe(false);
    expect(validEvaluationGaps(gaps, false)).toBe(false);
  });

test('completed facts must have exactly two complete arms', () => {
  const history = evaluationHistoryFixture(); history.cases[0].gaps[0] = 'cache_missing';
  expect(validEvaluationHistory(history)).toBe(false);
  expect(evaluationArmGap()).toBe('invalid_response');
});

test.each(['misses', 'unavailable', 'output_limited', 'context_limit_suspected', 'invalid', 'proposed'])(
  'worker boundary reconciles %s diagnoses against arm-level report counters', status => {
    const history = evaluationHistoryFixture({ status, labeled: false });
    const aiReplay = createCachedAdjudicationReport();
    Object.assign(aiReplay, { eligible: 60, selected: 25, budgetSkipped: 35 });
    for (let index = 0; index < 25; index++) addCachedAdjudicationPair(aiReplay,
      [1, 2].map(destinationId => ({ status, destinationId, latencyMs: 1, promptTokens: 1, outputTokens: 1 })));
    const report = { sampled: 60, aiReplay };
    expect(readCachedAdjudicationReport(aiReplay, 60)).not.toBeNull();
    expect(validEvaluationHistory(history, report)).toBe(true);
    aiReplay.baseline.misses++;
    expect(validEvaluationHistory(history, report)).toBe(false);
    expect(validEvaluationHistory(history, { sampled: 60 })).toBe(false);
  });
