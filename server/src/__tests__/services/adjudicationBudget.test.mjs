/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { validateAdjudicationBudget, remainingAdjudicationCalls, projectAdjudicationBudget } from '../../services/adjudicationBudgetContract.mjs';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';
import { executeAutomaticSourcePair } from '../../services/automaticSourcePairExecution.mjs';
import { sourcePairFixture, sourcePairIdentity } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { replayCachedAdjudication } from '../../services/cachedAdjudicationReplay.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';

test('explicit dual ceilings, conservative reservations and bounded private status', () => {
  expect(validateAdjudicationBudget({ dailyCalls: 0,dailyTokens: 0 })).toEqual({ dailyCalls: 0,dailyTokens: 0 });
  for (const [dailyCalls,dailyTokens] of [[1,0],[0,8448],[201,1689600],[1,8447],[1,1689601],[1.5,8448],[-1,0]]) {
    expect(() => validateAdjudicationBudget({ dailyCalls,dailyTokens })).toThrow('invalid');
  }
  expect(remainingAdjudicationCalls({ daily_calls: 100,daily_tokens: 1689600,calls_reserved: 0,tokens_reserved: 0 })).toBe(5);
  expect(remainingAdjudicationCalls({ daily_calls: 100,daily_tokens: 16896,calls_reserved: 1,tokens_reserved: 8448 })).toBe(1);
  expect(remainingAdjudicationCalls({ daily_calls: 0,daily_tokens: 0,calls_reserved: 1,tokens_reserved: 8448 })).toBe(0);
  expect(JSON.stringify(projectAdjudicationBudget({ progress: 'PRIVATE',published_fingerprint: 'PRIVATE' }))).not.toContain('PRIVATE');
});

test('CLI requires separate modes and explicit budgets, with no model work during configuration or status', async () => {
  const env = { ...process.env }, evaluate = jest.fn(async () => ({ status: 'complete' }));
  try {
    for (const argv of [['--daily-calls','2'],['--configure-source-pair-ai-budget'],
      ['--configure-source-pair-ai-budget','--daily-calls','2','--daily-tokens','08448'],
      ['--source-pair-ai-budget-status','--capture-source-pair-ai','--max-calls','2'],
      ['--source-pair-ai-budget-status','--configure-source-pair-ai-budget']]) {
      await expect(runOperatorCorrectionPolicyEvaluation({ argv,evaluate })).rejects.toThrow();
    }
    expect(evaluate).not.toHaveBeenCalled();
    await runOperatorCorrectionPolicyEvaluation({ argv: ['--configure-source-pair-ai-budget','--daily-calls','10','--daily-tokens','84480'],evaluate });
    expect(evaluate).toHaveBeenLastCalledWith({ dailyCalls: 10,dailyTokens: 84480 });
    await runOperatorCorrectionPolicyEvaluation({ argv: ['--source-pair-ai-budget-status'],evaluate });
    expect(evaluate).toHaveBeenLastCalledWith({ status: true });
  } finally { process.env = env; }
});

async function fixture() {
  const source = sourcePairFixture();
  source.evaluationRows = source.rows.map(row => ({ ...row,title: 'Synthetic item',year: 2020 }));
  source.rows = source.evaluationRows;
  source.policies = source.libraries.map(library => ({ id: library.id,library_id: library.id,enabled: true,
    name: 'Synthetic policy',library_name: library.name,library_media_type: library.media_type,priority: 1,
    auto_classify_threshold: 85,prompt_threshold: 60,profile_weight: .5,rag_weight: .5,
    trust_rag: true,trust_patterns: false,trust_history: false,presets: [] }));
  source.policySourceRevisionRows = source.policies.map(policy => ({ policy_id: policy.id,
    media_type: policy.library_media_type,source_updated_at: '2026-09-01',mutable_attachment: false }));
  const snapshot = { observedAt: '2026-09-25 01:00:00+00',inputs: { source,identity: sourcePairIdentity } };
  const prepared = await executeAutomaticSourcePair(snapshot,null);
  const evaluation = { status: 'complete',report: prepared.report,input_fingerprint: prepared.fingerprint,
    cohort: prepared.cohort,cohort_created_at: prepared.cohortCreatedAt };
  const state = { revision: 1,daily_calls: 20,daily_tokens: 168960,calls_reserved: 0,tokens_reserved: 0,cooling_down: false };
  const checkpoint = { publish: jest.fn() };
  const budget = { read: jest.fn(async () => state),finish: jest.fn(),advance: jest.fn(),reserve: jest.fn(),checkpoint: jest.fn(() => checkpoint) };
  const capture = jest.fn(async (_options, dependencies) => {
    await dependencies.onPublished(prepared.fingerprint,true,new AbortController().signal);
    return { calls: 5,reused: 0,stored: 5 };
  });
  const repository = { readState: jest.fn(async () => evaluation),readSnapshot: jest.fn(async () => snapshot) };
  const dependencies = { budget,repository,capture,withAdmission: (callback,{ signal }) => callback(signal) };
  return { state,budget,capture,repository,evaluation,snapshot,prepared,dependencies,worker: createAdjudicationBudgetWorker(dependencies) };
}

test.each(['disabled','cooldown','budget_exhausted','not_ready'])('worker %s does not generate', async mode => {
  const { state,worker,capture,repository } = await fixture();
  if (mode === 'disabled') state.daily_calls = 0;
  if (mode === 'cooldown') state.cooling_down = true;
  if (mode === 'budget_exhausted') state.tokens_reserved = state.daily_tokens;
  if (mode === 'not_ready') repository.readState.mockResolvedValue(null);
  expect((await worker.run()).status).toBe(mode === 'not_ready' ? 'deferred' : mode);
  expect(capture).not.toHaveBeenCalled();
});

test('capture is single-flight, limited per tick, and pins publication for rotation only after replay', async () => {
  const { worker,capture,budget,state,evaluation } = await fixture();
  const first = worker.run(); expect(worker.run()).toBe(first);
  expect(await first).toMatchObject({ status: 'captured',calls: 5 });
  expect(capture).toHaveBeenCalledWith({ maxCalls: 5 },expect.any(Object));
  expect(budget.finish).toHaveBeenCalledWith(1,'captured',expect.stringMatching(/^[a-f0-9]{64}$/),expect.anything());
  state.published_fingerprint = evaluation.input_fingerprint;
  await worker.run(); expect(budget.advance).toHaveBeenCalledWith(1,evaluation.report.aiReplay.eligible,expect.anything());
  worker.stop(); expect(await worker.run()).toEqual({ status: 'stopped' });
});

test.each(['adjudication_budget_exhausted','inventory_discovery_deferred','PRIVATE provider detail'])('failure %s is bounded and private', async message => {
  const { worker,capture } = await fixture(); capture.mockRejectedValue(new Error(message));
  const result = await worker.run(); expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(result.status).toBe(message.includes('exhausted') ? 'budget_exhausted' : message.includes('deferred') ? 'deferred' : 'unavailable');
  expect(await worker.run()).toEqual({ status: 'cooldown' });
});

test('admission rechecks disabled/cooling state and cancellation never leaks provider details', async () => {
  for (const stateChange of [{ daily_calls: 0 },{ cooling_down: true }]) {
    const { state,budget,capture,worker } = await fixture();
    budget.read.mockResolvedValueOnce(state).mockResolvedValue({ ...state,...stateChange });
    expect((await worker.run()).status).toBe(stateChange.cooling_down ? 'cooldown' : 'disabled');
    expect(capture).not.toHaveBeenCalled();
  }
  const { dependencies,capture } = await fixture();
  const worker = createAdjudicationBudgetWorker(dependencies);
  capture.mockImplementation(async (_options,{ signal }) => { worker.stop(); signal.throwIfAborted(); });
  expect(await worker.run()).toEqual({ status: 'stopped' });
});

test('database failures use local retry cooldown and stale publication markers allow current work to recover', async () => {
  const { state,budget,worker,capture } = await fixture();
  budget.read.mockRejectedValueOnce(new Error('PRIVATE database detail'));
  expect(await worker.run()).toEqual({ status: 'unavailable' });
  expect(await worker.run()).toEqual({ status: 'cooldown' });
  const next = await fixture(); next.state.published_fingerprint = 'e'.repeat(64);
  expect((await next.worker.run()).status).toBe('captured');
  expect(next.budget.advance).not.toHaveBeenCalled(); expect(next.capture).toHaveBeenCalledTimes(1);
  state.published_fingerprint = 'f'.repeat(64); expect(capture).not.toHaveBeenCalled();
});

test('rotation covers both media without using correction labels and handles a shrinking eligible population', async () => {
  const rows = new Map(Array.from({ length: 60 },(_,index) => [String(index).padStart(3,'0'),{
    key: `private:${index}`,mediaType: index % 2 ? 'tv' : 'movie',outcome: { kind: 'review' },common: { mode: 'none' },
  }]));
  const reports = [];
  for (const offset of [0,25,50,299]) reports.push(await replayCachedAdjudication([rows,rows],new Map(),{ adjudicationSelectionOffset: offset }));
  expect(reports.map(report => [report.selectionOffset,report.selected])).toEqual([[0,25],[25,25],[50,10],[0,25]]);
  await expect(replayCachedAdjudication([rows,rows],new Map(),{ adjudicationSelectionOffset: -1 })).rejects.toThrow('invalid');
});

test('local generation awaits durable reservation and does not send a request after failed reservation', async () => {
  const identity = { model: 'test:latest',digest: 'a'.repeat(64),contextLength: 8192 };
  const fetchRequest = jest.fn(async url => new Response(JSON.stringify(url.endsWith('/api/tags')
    ? { models: [{ name: identity.model,digest: identity.digest }] }
    : { capabilities: ['completion'],model_info: { 'general.architecture': 'test','test.context_length': 8192 } })));
  const client = createLocalDescriptionBenchmarkClient({ primary_provider: 'ollama',ollama_host: 'localhost',ollama_model: 'test:latest' },{ fetchRequest });
  const reserve = jest.fn(async () => { await Promise.resolve(); throw new Error('reservation_rejected'); });
  await expect(client.generate({ prompt: 'Synthetic prompt',count: 2,context: 8192,identity,responseContract: 'adjudication',onGenerationCall: reserve })).rejects.toThrow('reservation_rejected');
  expect(reserve).toHaveBeenCalledTimes(1);
  expect(fetchRequest.mock.calls.some(([url]) => url.endsWith('/api/generate'))).toBe(false);
});
