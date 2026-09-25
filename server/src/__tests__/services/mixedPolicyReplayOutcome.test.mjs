/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { automaticEvaluationOutcome, evaluationPairKind } from '../../services/mixedPolicyReplayOutcome.mjs';
import { createCachedAdjudicationReport, addCachedAdjudicationPair, readCachedAdjudicationReport } from '../../services/cachedAdjudicationReport.mjs';
import { evaluationHistoryFixture } from '../fixtures/evaluationHistoryFixture.mjs';
import { evaluationHistoryCase, validEvaluationHistory } from '../../services/evaluationHistoryContract.mjs';
import { projectEvaluationHistory } from '../../services/evaluationHistorySummary.mjs';

const fixture = () => ({ row: { mediaType: 'movie', outcome: { kind: 'automatic', action: 'auto_classify', destination: '2' },
  common: { mode: 'skip', policyResult: { action: 'auto_classify', library: { id: 2 } } } },
libraries: [{ id: 2, media_type: 'movie', is_active: true }] });

test.each(['movie', 'tv'])('validates numeric/string identities for %s without consulting names or content', mediaType => {
  const { row, libraries } = fixture(); row.mediaType = mediaType; libraries[0].media_type = mediaType;
  expect(automaticEvaluationOutcome(row, libraries)).toEqual({ status: 'automatic', destinationId: '2' });
  libraries[0].id = '2'; row.common.policyResult.library = { library_id: '2' }; row.outcome.destination = 2;
  expect(automaticEvaluationOutcome(row, libraries)).toEqual({ status: 'automatic', destinationId: '2' });
  expect(automaticEvaluationOutcome({ outcome: { kind: 'review' } }, libraries)).toBeNull();
});

test.each([
  value => { value.row.mediaType = 'music'; }, value => { value.row.common.mode = 'adjudicate'; },
  value => { value.row.outcome.action = 'manual'; }, value => { value.row.common.policyResult.action = 'prompt_confirm'; },
  value => { value.row.outcome.destination = '1'; }, value => { value.row.common.policyResult.library = null; },
  value => { value.row.common = null; }, value => { value.row.common.policyResult.library.id = -1; },
  value => { value.row.common.policyResult.library.id = Number.MAX_SAFE_INTEGER + 1; },
  value => { value.libraries[0].is_active = false; }, value => { value.libraries[0].media_type = 'tv'; },
  value => { value.libraries.push(value.libraries[0]); }, value => { value.libraries = []; }, value => { value.libraries = undefined; },
])('rejects inconsistent automatic authority instead of falling through to AI', mutate => {
  const value = fixture(); mutate(value);
  expect(automaticEvaluationOutcome(value.row, value.libraries)).toEqual({ status: 'unavailable', gap: 'not_adjudication' });
});

const result = (status, destinationId = 2) => ({ status, destinationId, latencyMs: 1, promptTokens: 2, outputTokens: 3 });
const reportFor = results => {
  const report = createCachedAdjudicationReport(); Object.assign(report, { eligible: 1, selected: 1 });
  addCachedAdjudicationPair(report, results, { libraryId: 2 }); return report;
};
test('canonical destinations and abstention reductions are compared without inventing provider usage', () => {
  const report = reportFor([result('automatic', '2'), result('proposed', 2)]);
  expect(report).toMatchObject({ changedDestinations: 0, mixedPairs: 1, baseline: { historicalPromptTokens: 0, correctAutomatic: 1 } });
  expect(reportFor([result('abstained', null), result('automatic')])).toMatchObject({ deferralsReduced: 1, correctGains: 1 });
  expect(evaluationPairKind([])).toBe('incomplete');
});

test.each(['v1', 'v2'])('retains exact %s report compatibility but rejects injected new-version fields', version => {
  const value = reportFor([result('proposed'), result('proposed')]);
  value.version = `cached_adjudication_report.${version}`;
  value.changedProposals = value.changedDestinations; delete value.changedDestinations;
  for (const key of ['deterministicPairs', 'mixedPairs', 'aiPairs']) delete value[key];
  for (const arm of [value.baseline, value.sourceAware]) {
    for (const key of ['automatic', 'labeledAutomatic', 'correctAutomatic', 'wrongAutomatic']) delete arm[key];
  }
  if (version === 'v1') delete value.selectionOffset;
  expect(readCachedAdjudicationReport(value, 1)).toBe(value);
  expect(readCachedAdjudicationReport({ ...value, mixedPairs: 1 }, 1)).toBeNull();
  value.baseline.automatic = 1; expect(readCachedAdjudicationReport(value, 1)).toBeNull();
});

test.each([
  value => { value.mixedPairs = 0; }, value => { value.aiPairs = 1; value.mixedPairs = 0; },
  value => { value.deterministicPairs = 1; value.mixedPairs = 0; },
  value => { value.baseline.historicalPromptTokens = 1; }, value => { value.baseline.correctAutomatic = 2; },
  value => { value.baseline.automatic = 2; }, value => { value.changedDestinations = 2; },
  value => { value.paired = 0; value.labeledPairs = 0; value.mixedPairs = 0; },
  value => { value.deferralsReduced = 1; value.changedDestinations = 1; },
  value => { value.deferralsIncreased = 1; value.changedDestinations = 1; },
  value => { value.correctGains = 1; },
])('rejects misleading composition, usage and automatic label counts', mutate => {
  const value = reportFor([result('automatic'), result('proposed')]); mutate(value);
  expect(readCachedAdjudicationReport(value, 1)).toBeNull();
});

test('all bounded two-arm status combinations reconcile exactly, including incomplete pairs', () => {
  const statuses = ['automatic', 'proposed', 'abstained', 'misses', 'unavailable', 'invalid'];
  const report = createCachedAdjudicationReport();
  // Validate each two-pair composition; this covers both mixed directions and failures.
  for (const a of statuses) for (const b of statuses) for (const c of statuses) for (const d of statuses) {
    Object.assign(report, createCachedAdjudicationReport(), { eligible: 2, selected: 2 });
    addCachedAdjudicationPair(report, [result(a), result(b)]);
    addCachedAdjudicationPair(report, [result(c), result(d)]);
    expect(readCachedAdjudicationReport(report, 2)).toBe(report);
  }
});

test('mixed history facts reconcile with reports and retain no destination or model content', () => {
  const history = evaluationHistoryFixture(); history.cases = [evaluationHistoryCase('private', 'tv', [result('automatic'), result('proposed')], { libraryId: 2 })];
  const aiReplay = reportFor([result('automatic'), result('proposed')]); aiReplay.eligible = 60; aiReplay.budgetSkipped = 59;
  expect(validEvaluationHistory(history, { sampled: 60, aiReplay })).toBe(true);
  expect(projectEvaluationHistory([{ result: history, observed_at: '2026-09-25' }]).groups[0]).toMatchObject({ mixedPairs: 1, aiPairs: 0, legacyPairs: 0 });
  expect(JSON.stringify(history)).not.toMatch(/private|destinationId|latency|promptTokens/);
  history.cases[0].pairKind = 'ai'; expect(validEvaluationHistory(history, { sampled: 60, aiReplay })).toBe(false);
  history.cases[0].pairKind = 'incomplete'; expect(validEvaluationHistory(history)).toBe(false);
  history.cases[0].pairKind = 'deterministic'; history.cases[0].deferralReduced = true;
  expect(validEvaluationHistory(history)).toBe(false);
});

test.each(['v1', 'v2'])('legacy %s pairs retain unknown origins', version => {
  const history = evaluationHistoryFixture({ version: `evaluation_history.${version}` });
  expect(validEvaluationHistory(history)).toBe(true);
  expect(projectEvaluationHistory([{ result: history, observed_at: '2026-09-25' }]).groups[0]).toMatchObject({ legacyPairs: 25, aiPairs: 0, mixedPairs: 0, deterministicPairs: 0 });
});
