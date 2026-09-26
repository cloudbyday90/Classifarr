/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { consensusFixture, consensusConfig } from '../fixtures/policyCandidateConsensusFixture.mjs';
import { adjudicationRequest, readAdjudicationBatch, validAdjudicationPlan, adjudicationBatchDigest } from '../../services/cachedAdjudicationContract.mjs';
import { replayCachedAdjudication } from '../../services/cachedAdjudicationReplay.mjs';
import { readCachedAdjudicationReport } from '../../services/cachedAdjudicationReport.mjs';
import { captureCachedAdjudication } from '../../services/cachedAdjudicationCapture.mjs';
import { projectAdjudicationConfig } from '../../services/cachedAdjudicationRepository.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';
import { sourcePairFixture } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { fingerprintAutomaticSourcePairInputs } from '../../services/automaticSourcePairComputation.mjs';
import { evaluationHistoryCase } from '../../services/evaluationHistoryContract.mjs';

const identity = { model: 'test:latest', digest: 'c'.repeat(64), contextLength: 32768 };
const generated = (response = '{"decision":"PROPOSE","library_number":2}') => ({ response,
  latencyMs: 20, promptTokens: 100, outputTokens: 12, outputLimitReached: false,
  contextLimitSuspected: false, inputTruncation: 'unknown' });
function fixture() {
  const input = consensusFixture(), config = consensusConfig();
  const entry = { ...input, status: 'ready', arms: { protected: { contract: input.contract, evidence: input.evidence, prompt: 'PRIVATE exact prompt' } } };
  const source = { libraries: input.libraries, adjudicationConfig: projectAdjudicationConfig(config) };
  const request = adjudicationRequest(entry);
  const batch = { version: 'cached_adjudication.v1', configuration: source.adjudicationConfig.fingerprint,
    identity, records: [{ key: request.key, generated: generated() }] };
  const row = { key: 'movie:999', mediaType: 'movie', outcome: { kind: 'review', action: 'prompt_select', destination: null },
    common: { mode: 'adjudicate', policyResult: input.policyResult }, runtime: { metadata: input.metadata } };
  return { input, config, entry, source, request, batch, row, outcomes: [new Map([['a', row]]), new Map([['a', row]])] };
}

test('exact requests, schema bounds, candidate order and provenance prevent unrelated cache reuse', () => {
  const { entry, request, batch } = fixture();
  expect(validAdjudicationPlan([request])).toBe(true);
  expect(validAdjudicationPlan([request, request])).toBe(false);
  expect(readAdjudicationBatch(batch, batch.configuration)).toBe(batch);
  expect(readAdjudicationBatch(batch, 'd'.repeat(64))).toBeNull();
  const reordered = structuredClone(entry); reordered.arms.protected.contract.candidates.reverse();
  expect(adjudicationRequest(reordered).key).not.toBe(request.key);
  entry.arms.protected.prompt += 'changed'; expect(adjudicationRequest(entry).key).not.toBe(request.key);
  entry.arms.protected.prompt = 'x'.repeat(30000); expect(adjudicationRequest(entry)).toBeNull();
  for (const mutate of [value => { value.secret = 'PRIVATE'; }, value => { value.identity.digest = ''; },
    value => { value.records.push(value.records[0]); }, value => { value.records[0].generated.response = 'x'.repeat(16385); },
    value => { value.records[0].generated.promptTokens = 8193; }, value => { value.records[0].generated.latencyMs = -1; }]) {
    const invalid = structuredClone(batch); mutate(invalid); expect(readAdjudicationBatch(invalid, batch.configuration)).toBeNull();
  }
});

test('batch evidence fingerprints ignore JSONB object-key and record insertion order, not response changes', () => {
  const { batch } = fixture(); batch.records.push({ ...batch.records[0],key: 'f'.repeat(64) });
  const reordered = JSON.parse(JSON.stringify(batch));
  reordered.records.reverse();
  reordered.records[0].generated = Object.fromEntries(Object.entries(reordered.records[0].generated).reverse());
  reordered.identity = Object.fromEntries(Object.entries(reordered.identity).reverse());
  expect(adjudicationBatchDigest(reordered)).toBe(adjudicationBatchDigest(batch));
  reordered.records[0].generated.response += 'changed';
  expect(adjudicationBatchDigest(reordered)).not.toBe(adjudicationBatchDigest(batch));
});

test('cold cache becomes explicit misses; exact replay uses the production reducer with no routing authority', async () => {
  const { source, entry, outcomes, batch } = fixture(), prepare = jest.fn(async () => entry), plans = [];
  const labels = new Map([['movie:999', { libraryId: 2 }]]);
  const cold = await replayCachedAdjudication(outcomes, labels, source, { prepare, onPlan: plan => plans.push(plan) });
  expect(cold).toMatchObject({ selected: 1, paired: 0, baseline: { misses: 1 }, limits: { providerCalls: 0 } });
  expect(plans[0]).toHaveLength(1);
  source.adjudicationBatch = batch;
  const warm = await replayCachedAdjudication(outcomes, labels, source, { prepare });
  expect(warm).toMatchObject({ paired: 1, labeledPairs: 1,
    baseline: { hits: 1, proposed: 1, correctProposals: 1, historicalPromptTokens: 100 },
    sourceAware: { hits: 1, proposed: 1 }, limits: { routingWrites: 0, currentModelVerified: false } });
  expect(readCachedAdjudicationReport(warm, 1)).toBe(warm);
  expect(JSON.stringify(warm)).not.toMatch(/PRIVATE|destinationId|digest|test:latest/);
  for (const mutate of [value => { value.secret = true; }, value => { value.limits.providerCalls = 1; },
    value => { value.baseline.hits = 2; }, value => { value.correctGains = 2; }]) {
    const invalid = structuredClone(warm); mutate(invalid); expect(readCachedAdjudicationReport(invalid, 1)).toBeNull();
  }
});

const automaticRow = (row, destination = 1) => ({ ...row, runtime: null,
  outcome: { kind: 'automatic', action: 'auto_classify', destination: String(destination) },
  common: { mode: 'skip', policyResult: { action: 'auto_classify', library: { id: destination } } } });

test.each(['baseline', 'sourceAware'])('mixed replay uses the actual %s automatic decision and one cached production AI reduction', async arm => {
  const { source, entry, outcomes, batch, row } = fixture(), prepare = jest.fn(async () => entry), onPlan = jest.fn(), onCase = jest.fn();
  source.adjudicationBatch = batch;
  outcomes[arm === 'baseline' ? 0 : 1].set('a', automaticRow(row));
  const report = await replayCachedAdjudication(outcomes, new Map([['movie:999', { libraryId: 2 }]]), source, { prepare, onPlan, onCase });
  expect(report).toMatchObject({ paired: 1, mixedPairs: 1, deterministicPairs: 0, aiPairs: 0, changedDestinations: 1,
    labeledPairs: 1, correctGains: arm === 'baseline' ? 1 : 0, correctRegressions: arm === 'sourceAware' ? 1 : 0,
    [arm]: { automatic: 1, hits: 0, labeledAutomatic: 1, wrongAutomatic: 1, historicalLatencyMs: 0, historicalPromptTokens: 0, historicalOutputTokens: 0 } });
  expect(readCachedAdjudicationReport(report, 1)).toBe(report);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(onPlan.mock.calls[0][0]).toHaveLength(1);
  expect(evaluationHistoryCase(...onCase.mock.calls[0])).toMatchObject({ pairKind: 'mixed', gaps: ['none', 'none'] });
});

test.each(['proposed', 'abstained', 'invalid', 'misses'])('mixed replay with %s keeps evidence and deferral semantics honest', async status => {
  const { source, entry, outcomes, batch, row } = fixture();
  if (status !== 'misses') source.adjudicationBatch = batch;
  if (status === 'abstained') batch.records[0].generated.response = '{"decision":"ABSTAIN","library_number":null}';
  if (status === 'invalid') batch.records[0].generated.response = 'PRIVATE invalid';
  outcomes[0].set('a', automaticRow(row, 2));
  const report = await replayCachedAdjudication(outcomes, new Map(), source, { prepare: async () => entry });
  expect(report.baseline).toMatchObject({ automatic: 1, labeledAutomatic: 0, correctAutomatic: 0 });
  expect(report).toMatchObject({ paired: ['proposed', 'abstained'].includes(status) ? 1 : 0, labeledPairs: 0,
    changedDestinations: status === 'abstained' ? 1 : 0, deferralsIncreased: status === 'abstained' ? 1 : 0 });
  expect(report.sourceAware[status]).toBe(1);
  expect(readCachedAdjudicationReport(report, 1)).toBe(report);
});

test('differing automatic decisions complete without AI configuration, runtime, requests or usage; agreeing decisions stay excluded', async () => {
  const { source, outcomes, row } = fixture(), prepare = jest.fn(), reduce = jest.fn(), onPlan = jest.fn();
  delete source.adjudicationConfig;
  outcomes[0].set('a', automaticRow(row, 1)); outcomes[1].set('a', automaticRow(row, 2));
  const report = await replayCachedAdjudication(outcomes, new Map([['movie:999', { libraryId: '2' }]]), source, { prepare, reduce, onPlan });
  expect(report).toMatchObject({ paired: 1, deterministicPairs: 1, mixedPairs: 0, changedDestinations: 1, correctGains: 1,
    sourceAware: { automatic: 1, correctAutomatic: 1, hits: 0, historicalPromptTokens: 0 } });
  expect(readCachedAdjudicationReport(report, 1)).toBe(report);
  expect(prepare).not.toHaveBeenCalled(); expect(reduce).not.toHaveBeenCalled(); expect(onPlan).toHaveBeenCalledWith([]);
  outcomes[1].set('a', automaticRow(row, 1));
  expect(await replayCachedAdjudication(outcomes, new Map(), source)).toMatchObject({ selected: 0, paired: 0 });
});

test.each(['malformed', 'limited', 'abstained', 'wrong'])('cached %s outputs remain visible without being treated as correct', async kind => {
  const { source, entry, outcomes, batch } = fixture(); source.adjudicationBatch = batch;
  if (kind === 'malformed') batch.records[0].generated.response = 'PRIVATE not JSON';
  if (kind === 'limited') batch.records[0].generated.outputLimitReached = true;
  if (kind === 'abstained') batch.records[0].generated.response = '{"decision":"ABSTAIN","library_number":null}';
  const report = await replayCachedAdjudication(outcomes, new Map([['movie:999', { libraryId: kind === 'wrong' ? 1 : 2 }]]), source,
    { prepare: async () => entry });
  expect(report.baseline.correctProposals).toBe(0);
  expect(report.baseline[kind === 'wrong' ? 'wrongProposals' : kind === 'abstained' ? 'abstained' : 'invalid']).toBe(1);
});

test('admission is bounded, deterministic, interleaves both media and does not consult labels', async () => {
  const { source, entry, row } = fixture(), rows = new Map();
  for (let index = 0; index < 100; index++) rows.set(String(index).padStart(3, '0'), { ...row,
    key: `private:${index}`, mediaType: index < 50 ? 'movie' : 'tv', runtime: { metadata: { ordinal: index } } });
  const visited = [], prepare = async ({ metadata }) => { visited.push(metadata.ordinal); return entry; };
  const a = await replayCachedAdjudication([rows, rows], new Map(), source, { prepare });
  expect(a).toMatchObject({ eligible: 100, selected: 25, budgetSkipped: 75 });
  expect(visited.slice(0, 8)).toEqual([0, 0, 50, 50, 1, 1, 51, 51]);
  const b = await replayCachedAdjudication([rows, rows], new Map([['private:99', { libraryId: 2 }]]), source, { prepare });
  expect(b).toEqual(a);
});

function captureFixture() {
  const { config, source, request, batch } = fixture();
  const snapshot = { inputs: { source: { ...sourcePairFixture(), ...source } } };
  const dependencies = { repository: { readState: jest.fn(async () => null), readSnapshot: jest.fn(async () => structuredClone(snapshot)) },
    readConfig: jest.fn(async () => config), save: jest.fn(),
    withAdmission: (callback, { signal }) => callback(signal), runThread: jest.fn(async supplied => capturePlan([request], supplied)) };
  const client = { inspect: jest.fn(async () => identity), generate: jest.fn(async ({ onGenerationCall }) => { onGenerationCall(); return generated(); }) };
  dependencies.createClient = jest.fn(() => client);
  return { snapshot, dependencies, client, batch };
}

function capturePlan(plan, snapshot) {
  const cached = new Set(snapshot?.inputs.source.adjudicationBatch?.records.map(row => row.key) ?? []);
  return { plan, captureAdmission: plan.map(request => ({ item: request.key, mediaType: 'movie', stratum: 'a'.repeat(64),
    arms: [0, 1].map(() => ({ key: request.key, gap: cached.has(request.key) ? 'none' : 'cache_missing' })) })) };
}

test('explicit capture budgets generation, atomically stores responses only, and reuses a matching model artifact', async () => {
  const { snapshot, dependencies, client, batch } = captureFixture();
  expect(await captureCachedAdjudication({ maxCalls: 1 }, dependencies)).toMatchObject({ status: 'complete', calls: 1, stored: 1 });
  expect(JSON.stringify(dependencies.save.mock.calls[0][0])).not.toMatch(/PRIVATE|prompt"|metadata|libraryId/);
  snapshot.inputs.source.adjudicationBatch = batch;
  expect(await captureCachedAdjudication({ maxCalls: 1 }, dependencies)).toMatchObject({ calls: 0, reused: 1 });
  expect(client.generate).toHaveBeenCalledTimes(1);
});

test('capture never exceeds the explicit call budget and empty admission never creates a provider client', async () => {
  const { dependencies, client } = captureFixture();
  const request = fixture().request;
  dependencies.runThread.mockImplementation(async supplied => capturePlan(Array.from({ length: 6 }, (_, index) =>
    ({ ...request, key: String(index).repeat(64) })), supplied));
  expect(await captureCachedAdjudication({ maxCalls: 2 }, dependencies)).toMatchObject({ calls: 2, stored: 2, missing: 4 });
  expect(client.generate).toHaveBeenCalledTimes(2);
  dependencies.createClient.mockClear(); dependencies.runThread.mockResolvedValue(capturePlan([]));
  expect(await captureCachedAdjudication({ maxCalls: 2 }, dependencies)).toMatchObject({ status: 'no_eligible_cases', calls: 0 });
  expect(dependencies.createClient).not.toHaveBeenCalled();
});

test('empty capture plans need no configuration or model but still reject source drift before completion', async () => {
  const { snapshot, dependencies } = captureFixture();
  delete snapshot.inputs.source.adjudicationConfig;
  dependencies.runThread.mockResolvedValue(capturePlan([])); dependencies.onPublished = jest.fn();
  expect(await captureCachedAdjudication({ maxCalls: 1 }, dependencies)).toMatchObject({ calls: 0 });
  expect(dependencies.readConfig).not.toHaveBeenCalled(); expect(dependencies.createClient).not.toHaveBeenCalled();
  expect(dependencies.onPublished).toHaveBeenCalledTimes(1);
  const changed = structuredClone(snapshot); changed.inputs.source.rows[0].overview += 'changed';
  dependencies.repository.readSnapshot.mockResolvedValueOnce(snapshot).mockResolvedValue(changed);
  await expect(captureCachedAdjudication({ maxCalls: 1 }, dependencies)).rejects.toThrow('source_changed');
  expect(dependencies.onPublished).toHaveBeenCalledTimes(1); expect(dependencies.save).not.toHaveBeenCalled();
});

test.each(['budget', 'cancelled', 'provider', 'drift', 'model', 'config'])('capture rejects %s without replacing prior evidence', async mode => {
  const { dependencies, client, snapshot } = captureFixture(), controller = new AbortController();
  if (mode === 'cancelled') controller.abort();
  if (mode === 'provider') client.generate.mockRejectedValue(new Error('PRIVATE failure'));
  if (mode === 'drift') {
    const changed = structuredClone(snapshot); changed.inputs.source.rows[0].overview += 'changed';
    dependencies.repository.readSnapshot.mockResolvedValueOnce(snapshot).mockResolvedValue(changed);
  }
  if (mode === 'model') client.inspect.mockResolvedValueOnce(identity).mockResolvedValue({ ...identity, digest: 'd'.repeat(64) });
  if (mode === 'config') dependencies.readConfig.mockResolvedValue({});
  await expect(captureCachedAdjudication({ maxCalls: mode === 'budget' ? 0 : 1 }, { ...dependencies, signal: controller.signal })).rejects.toThrow();
  expect(dependencies.save).not.toHaveBeenCalled();
});

test('database vector order is not semantic drift, but changed vectors reject publication', async () => {
  const { snapshot, dependencies } = captureFixture();
  const changed = structuredClone(snapshot);
  changed.inputs.source.vectors = new Map([...changed.inputs.source.vectors].reverse());
  dependencies.repository.readSnapshot.mockResolvedValueOnce(snapshot).mockResolvedValue(changed);
  expect(await captureCachedAdjudication({ maxCalls: 1 }, dependencies)).toMatchObject({ status: 'complete' });
  dependencies.save.mockClear();
  changed.inputs.source.vectors.set([...changed.inputs.source.vectors.keys()][0], [0, 1]);
  dependencies.repository.readSnapshot.mockReset().mockResolvedValueOnce(snapshot).mockResolvedValue(changed);
  await expect(captureCachedAdjudication({ maxCalls: 1 }, dependencies)).rejects.toThrow('source_changed');
  expect(dependencies.save).not.toHaveBeenCalled();
});

test('rotation completion identifies the captured evidence even if source data changes immediately after publication', async () => {
  const { snapshot,dependencies } = captureFixture(), original = structuredClone(snapshot), onPublished = jest.fn();
  dependencies.save.mockImplementation(async () => { snapshot.inputs.source.rows[0].overview += 'newer source'; });
  await captureCachedAdjudication({ maxCalls: 1 },{ ...dependencies,onPublished });
  original.inputs.source.adjudicationBatch = dependencies.save.mock.calls[0][0];
  expect(onPublished).toHaveBeenCalledWith(fingerprintAutomaticSourcePairInputs(original,{}),true,expect.anything());
  snapshot.inputs.source.adjudicationBatch = original.inputs.source.adjudicationBatch;
  expect(onPublished.mock.calls[0][0]).not.toBe(fingerprintAutomaticSourcePairInputs(snapshot,{}));
});

test('capture CLI requires its own explicit call budget and rejects mixed modes before loading a runtime', async () => {
  const evaluate = jest.fn(async () => ({ status: 'complete' }));
  for (const argv of [['--capture-source-pair-ai'], ['--max-calls', '2'],
    ['--capture-source-pair-ai', '--max-calls', '51'], ['--capture-source-pair-ai', '--max-calls', '2', '--source-pair']]) {
    await expect(runOperatorCorrectionPolicyEvaluation({ argv, evaluate })).rejects.toThrow();
  }
  expect(evaluate).not.toHaveBeenCalled();
  await runOperatorCorrectionPolicyEvaluation({ argv: ['--capture-source-pair-ai', '--max-calls', '2'], evaluate });
  expect(evaluate).toHaveBeenCalledWith({ maxCalls: 2 });
});

test.each(['configuration_unavailable', 'runtime_unavailable', 'not_adjudication', 'scope_unavailable',
  'evidence_unavailable', 'evidence_changed', 'request_invalid'])('replay retains the actual %s preparation gap without private data', async gap => {
  const { source, entry, row, outcomes } = fixture();
  if (gap === 'configuration_unavailable') delete source.adjudicationConfig;
  if (gap === 'runtime_unavailable') delete row.runtime;
  if (gap === 'not_adjudication') row.common.mode = 'none';
  if (gap === 'request_invalid') entry.arms.protected.prompt = 'x'.repeat(30000);
  const cases = [];
  const prepare = jest.fn(async () => ['scope_unavailable', 'evidence_unavailable', 'evidence_changed'].includes(gap)
    ? { status: gap, private: 'PRIVATE' } : entry);
  await replayCachedAdjudication(outcomes, new Map(), source,
    { prepare, onCase: (...args) => cases.push(evaluationHistoryCase(...args)) });
  expect(cases[0]).toMatchObject({ paired: false, gaps: [gap, gap] });
  expect(JSON.stringify(cases)).not.toContain('PRIVATE');
  if (['configuration_unavailable', 'runtime_unavailable', 'not_adjudication'].includes(gap)) expect(prepare).not.toHaveBeenCalled();
});

test('backfill resolves cache gaps while invalid cached output remains a measured failure, not retry-until-success', async () => {
  const { source, entry, outcomes } = fixture();
  const cases = [], replay = () => replayCachedAdjudication(outcomes, new Map(), source,
    { prepare: async () => entry, onCase: (...args) => cases.push(evaluationHistoryCase(...args)) });
  await replay(); expect(cases.at(-1).gaps).toEqual(['cache_missing', 'cache_missing']);
  const { snapshot, dependencies, client } = captureFixture();
  client.generate.mockImplementation(async ({ onGenerationCall }) => { await onGenerationCall(); return generated('PRIVATE invalid'); });
  dependencies.save.mockImplementation(async batch => { source.adjudicationBatch = batch; snapshot.inputs.source.adjudicationBatch = batch; });
  await captureCachedAdjudication({ maxCalls: 1 }, dependencies);
  await replay(); expect(cases.at(-1).gaps).toEqual(['invalid_response', 'invalid_response']);
  expect(await captureCachedAdjudication({ maxCalls: 1 }, dependencies)).toMatchObject({ calls: 0, reused: 1 });
  expect(client.generate).toHaveBeenCalledTimes(1);
  source.adjudicationBatch.records[0].generated = generated();
  await replay(); expect(cases.at(-1)).toMatchObject({ paired: true, labeled: false, gaps: ['none', 'none'] });
});
