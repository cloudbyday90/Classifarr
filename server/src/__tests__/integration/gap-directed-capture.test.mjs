/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createAdjudicationBudgetRepository } from '../../services/adjudicationBudgetRepository.mjs';
import { captureCachedAdjudication } from '../../services/cachedAdjudicationCapture.mjs';
import { readCachedAdjudication, projectAdjudicationConfig } from '../../services/cachedAdjudicationRepository.mjs';
import { adjudicationDigest } from '../../services/cachedAdjudicationContract.mjs';
import { sourcePairFixture } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { gapDirectedCaptureFixture, syntheticCaptureIdentity, syntheticCaptureResponse } from '../fixtures/gapDirectedCaptureFixture.mjs';

let database, budget, fixture, snapshot, config;
const query = (...args) => getPool().query(...args);
const progress = async () => (await query('SELECT progress_key,progress,captured_at,expires_at FROM adjudication_capture_budget')).rows[0];
beforeEach(async () => {
  await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch');
  database = createIntegrationDatabaseModuleMock(); budget = createAdjudicationBudgetRepository(database);
  fixture = gapDirectedCaptureFixture();
  config = { primary_provider: 'ollama', ollama_host: 'localhost', ollama_model: 'test:latest' };
  fixture.source.adjudicationConfig = projectAdjudicationConfig(config);
  snapshot = { observedAt: new Date().toISOString(), inputs: { source: { ...sourcePairFixture(300),
    adjudicationSelectionOffset: 0, adjudicationConfig: fixture.source.adjudicationConfig } } };
});

function dependencies(revision, generate, onPublished = jest.fn()) {
  const checkpoint = budget.checkpoint(revision);
  return { repository: { readState: async () => null, readSnapshot: async () => ({ ...snapshot,
    inputs: { ...snapshot.inputs, source: { ...snapshot.inputs.source,
      adjudicationBatch: await readCachedAdjudication(getPool(), fixture.source.adjudicationConfig.fingerprint) } } }) },
  // Synthetic replay isolates scheduling; the existing automatic-worker suite exercises the real thread/reducer.
  runThread: async supplied => ({ ...await fixture.replay(supplied.inputs.source.adjudicationBatch?.records ?? []),
    cohort: [], cohortCreatedAt: snapshot.observedAt }),
  readConfig: async () => config, createClient: () => ({ inspect: async () => syntheticCaptureIdentity, generate }),
  checkpoint: { ...checkpoint, reserve: signal => budget.reserve(revision, signal) },
  save: checkpoint.publish, onPublished, withAdmission: (callback, { signal }) => callback(signal) };
}

test('old canonical checkpoints survive new priorities, interruption and restart; rejected records and retention remain intact', async () => {
  const state = await budget.configure({ dailyCalls: 40, dailyTokens: 337920 });
  const prepared = await fixture.replay(), checkpoint = budget.checkpoint(state.revision), template = fixture.batch([]);
  await checkpoint.open(prepared.plan, template);
  const seeds = prepared.plan.filter(request => ['PRIVATE request 0 0', 'PRIVATE request 23 0', 'PRIVATE request 24 0'].includes(request.prompt));
  for (const request of seeds) {
    await budget.reserve(state.revision);
    await checkpoint.record({ key: request.key, generated: syntheticCaptureResponse(request.prompt === 'PRIVATE request 0 0' ? 'valid' : 'invalid') });
  }
  const before = await progress(), published = jest.fn();
  let calls = 0;
  const generate = jest.fn(async ({ onGenerationCall }) => {
    await onGenerationCall(); calls++;
    if (calls === 2) throw new Error('Synthetic interrupted response');
    return syntheticCaptureResponse();
  });
  await expect(captureCachedAdjudication({ maxCalls: 5 }, dependencies(state.revision, generate, published))).rejects.toThrow('interrupted');
  expect((await progress()).progress.records).toHaveLength(4);
  expect((await budget.read()).calls_reserved).toBe(5); // Three old responses plus success and unknown attempt.
  budget = createAdjudicationBudgetRepository(database);
  for (let tick = 0; tick < 8 && !published.mock.calls.at(-1)?.[1]; tick++) {
    const result = await captureCachedAdjudication({ maxCalls: 5 }, dependencies(state.revision, generate, published));
    expect(result.calls).toBeLessThanOrEqual(5);
  }
  expect(published.mock.calls.at(-1)?.[1]).toBe(true);
  const after = await progress();
  expect(after).toMatchObject({ progress_key: before.progress_key, captured_at: before.captured_at, expires_at: before.expires_at });
  expect(after.progress_key).toBe(adjudicationDigest({ configuration: template.configuration, identity: template.identity,
    requests: prepared.plan.map(row => row.key) }));
  expect(after.progress.records).toHaveLength(32);
  expect(after.progress.records.filter(row => row.generated.response === 'invalid')).toHaveLength(2);
  expect(after.progress.records.map(row => row.key)).toEqual(prepared.plan.filter(row => after.progress.records.some(saved => saved.key === row.key)).map(row => row.key));
  expect((await fixture.replay(after.progress.records)).report.paired).toBe(20);
  expect(generate.mock.calls.some(([input]) => seeds.some(seed => seed.prompt === input.prompt))).toBe(false);
  expect((await budget.read()).calls_reserved).toBe(33); // Unknown attempt stays charged, no retry-until-success.
  expect((await query('SELECT * FROM automatic_source_pair_sweep')).rows).toHaveLength(0);
  const retained = await readCachedAdjudication(getPool(), template.configuration);
  expect(retained).toEqual(after.progress);
  expect(JSON.stringify(retained)).not.toContain('PRIVATE request');
  expect(await captureCachedAdjudication({ maxCalls: 5 }, dependencies(state.revision, generate))).toMatchObject({ calls: 0, missing: 0, stored: 32 });
  expect((await progress()).expires_at).toEqual(before.expires_at);
});

test.each(['exhausted', 'disabled', 'changed', 'expired'])('%s allowance or retention fence prevents unsafe capture publication', async mode => {
  const state = await budget.configure({ dailyCalls: 1, dailyTokens: 8448 });
  if (mode === 'exhausted') await budget.reserve(state.revision);
  if (mode === 'disabled') await budget.configure({ dailyCalls: 0, dailyTokens: 0 });
  if (mode === 'changed') await budget.configure({ dailyCalls: 2, dailyTokens: 16896 });
  let sent = 0;
  const input = dependencies(state.revision, async ({ onGenerationCall }) => {
    await onGenerationCall(); sent++; return syntheticCaptureResponse();
  });
  if (mode === 'expired') {
    const record = input.checkpoint.record;
    input.checkpoint.record = async (...args) => {
      await query("UPDATE adjudication_capture_budget SET captured_at=now()-interval '8 days',expires_at=now()-interval '1 day'");
      return record(...args);
    };
  }
  await expect(captureCachedAdjudication({ maxCalls: 1 }, input)).rejects.toThrow(/exhausted|changed/);
  expect(sent).toBe(mode === 'expired' ? 1 : 0);
  expect(await readCachedAdjudication(getPool(), fixture.source.adjudicationConfig.fingerprint)).toBeNull();
});
