/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { captureCachedAdjudication } from '../../services/cachedAdjudicationCapture.mjs';
import { projectAdjudicationConfig } from '../../services/cachedAdjudicationRepository.mjs';
import { sourcePairFixture } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { gapDirectedCaptureFixture, syntheticCaptureIdentity, syntheticCaptureResponse } from '../fixtures/gapDirectedCaptureFixture.mjs';

function fixture() {
  const replay = gapDirectedCaptureFixture(25);
  const config = { primary_provider: 'ollama', ollama_host: 'localhost', ollama_model: 'test:latest' };
  replay.source.adjudicationConfig = projectAdjudicationConfig(config);
  const snapshot = { inputs: { source: { ...sourcePairFixture(), adjudicationConfig: replay.source.adjudicationConfig } } };
  const client = { inspect: jest.fn(async () => syntheticCaptureIdentity), generate: jest.fn(async ({ onGenerationCall }) => {
    await onGenerationCall(); return syntheticCaptureResponse();
  }) };
  const dependencies = { repository: { readState: async () => null, readSnapshot: jest.fn(async () => structuredClone(snapshot)) },
    readConfig: async () => config, createClient: jest.fn(() => client), save: jest.fn(), onPublished: jest.fn(),
    withAdmission: (callback, { signal }) => callback(signal),
    runThread: jest.fn(async supplied => replay.replay(supplied.inputs.source.adjudicationBatch?.records ?? [])) };
  return { replay, snapshot, dependencies, client };
}

test.each([undefined, [], [{ private: 'PRIVATE' }]])('missing or invalid initial admission rejects before model inspection: %j', async captureAdmission => {
  const { dependencies } = fixture();
  dependencies.runThread.mockResolvedValue({ plan: [{ key: 'a'.repeat(64), prompt: 'Synthetic', count: 2 }], captureAdmission });
  await expect(captureCachedAdjudication({ maxCalls: 5 }, dependencies)).rejects.toThrow('capture_plan_invalid');
  expect(dependencies.createClient).not.toHaveBeenCalled(); expect(dependencies.save).not.toHaveBeenCalled();
});

test.each(['admission', 'plan', 'cancelled'])('retained-evidence refresh rejects %s changes before generation or publication', async mode => {
  const { dependencies, client, replay } = fixture(), controller = new AbortController();
  const prepared = await replay.replay();
  dependencies.checkpoint = { open: async () => replay.batch([{ key: prepared.plan[0].key, generated: syntheticCaptureResponse() }]) };
  dependencies.runThread.mockImplementationOnce(async () => prepared).mockImplementationOnce(async supplied => {
    const refreshed = await replay.replay(supplied.inputs.source.adjudicationBatch.records);
    if (mode === 'admission') refreshed.captureAdmission[0].private = 'PRIVATE';
    if (mode === 'plan') refreshed.plan.reverse();
    if (mode === 'cancelled') controller.abort();
    return refreshed;
  });
  await expect(captureCachedAdjudication({ maxCalls: 5 }, { ...dependencies, signal: controller.signal })).rejects.toThrow();
  expect(client.generate).not.toHaveBeenCalled(); expect(dependencies.save).not.toHaveBeenCalled();
  expect(dependencies.onPublished).not.toHaveBeenCalled();
});

test('a changed model discards old admission judgments, not just the response lookup', async () => {
  const { dependencies, client, replay, snapshot } = fixture(), prepared = await replay.replay();
  snapshot.inputs.source.adjudicationBatch = replay.batch(prepared.plan.map(({ key }) => ({ key, generated: syntheticCaptureResponse('invalid') })));
  client.inspect.mockResolvedValue({ ...syntheticCaptureIdentity, digest: 'd'.repeat(64) });
  expect(await captureCachedAdjudication({ maxCalls: 1 }, dependencies)).toMatchObject({ calls: 1, reused: 0, stored: 1 });
  expect(dependencies.runThread).toHaveBeenCalledTimes(2);
  expect(dependencies.runThread.mock.calls[1][0].inputs.source.adjudicationBatch.records).toEqual([]);
  expect(dependencies.save.mock.calls[0][0].identity.digest).toBe('d'.repeat(64));
});

test('known blocked and rejected pairs finish admission without spending calls or claiming paired success', async () => {
  const { dependencies, client, replay, snapshot } = fixture();
  for (const rows of replay.outcomes) for (const key of rows.keys()) if (Number(key) < 20) rows.delete(key);
  const prepared = await replay.replay();
  const rejected = prepared.plan.filter(row => ['PRIVATE request 23 0', 'PRIVATE request 24 0'].includes(row.prompt))
    .map(({ key }) => ({ key, generated: syntheticCaptureResponse('invalid') }));
  snapshot.inputs.source.adjudicationBatch = replay.batch(rejected);
  expect(await captureCachedAdjudication({ maxCalls: 5 }, dependencies)).toMatchObject({ calls: 0, missing: 0, stored: 2 });
  expect(client.generate).not.toHaveBeenCalled(); expect(dependencies.runThread).toHaveBeenCalledTimes(1);
  expect(dependencies.save.mock.calls[0][0].records).toEqual(rejected);
  expect(dependencies.onPublished).toHaveBeenCalledWith(expect.any(String), true, expect.any(AbortSignal));
  expect((await replay.replay(rejected)).report).toMatchObject({ paired: 0, baseline: { invalid: 2, unavailable: 3 } });
});

test('source changes before sending or after generation prevent publication', async () => {
  for (const afterGeneration of [false, true]) {
    const { dependencies, snapshot, client } = fixture(), changed = structuredClone(snapshot);
    changed.inputs.source.rows[0].overview += 'Changed';
    dependencies.repository.readSnapshot.mockResolvedValue(changed).mockResolvedValueOnce(snapshot);
    if (afterGeneration) dependencies.repository.readSnapshot.mockResolvedValueOnce(snapshot);
    await expect(captureCachedAdjudication({ maxCalls: 1 }, dependencies)).rejects.toThrow('source_changed');
    expect(client.generate).toHaveBeenCalledTimes(afterGeneration ? 1 : 0);
    expect(dependencies.save).not.toHaveBeenCalled(); expect(dependencies.onPublished).not.toHaveBeenCalled();
  }
});
