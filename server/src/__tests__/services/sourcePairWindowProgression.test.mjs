/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, expect, jest, test } from '@jest/globals';
import { sourcePairWindowFixture, completedWindowReport } from '../fixtures/sourcePairWindowFixture.mjs';
import { planSourcePairWindowAdvance, createProgressingSourcePairEvaluation } from '../../services/sourcePairWindowProgression.mjs';
import { advanceEvaluatedSourcePairWindow } from '../../services/sourcePairWindowProgressionRepository.mjs';
import { readAutomaticSourcePairReport } from '../../services/automaticSourcePairReport.mjs';
import { fingerprintAutomaticSourcePairInputs } from '../../services/automaticSourcePairComputation.mjs';

let fixture;
beforeAll(async () => { fixture = await sourcePairWindowFixture(); });
const report = options => completedWindowReport(fixture.result.report, options);

test.each(['automatic', 'mixed', 'cached', 'invalid'])('fully accounted %s window can progress without inference', kind => {
  const value = report({ kind });
  expect(readAutomaticSourcePairReport(value)).toBe(value);
  expect(planSourcePairWindowAdvance(value, 0, 0)).toEqual({ revision: 0, selectionOffset: 0, nextOffset: 25 });
});

test('tail wrap, population shrink and nonzero single-window repair use the actual cursor', () => {
  expect(planSourcePairWindowAdvance(report({ offset: 25 }), 9, 25)).toEqual({ revision: 9, selectionOffset: 25, nextOffset: 0 });
  expect(planSourcePairWindowAdvance(report(), 9, 275)).toEqual({ revision: 9, selectionOffset: 275, nextOffset: 25 });
  expect(planSourcePairWindowAdvance(report({ eligible: 20 }), 9, 25)).toEqual({ revision: 9, selectionOffset: 25, nextOffset: 0 });
});

test.each(['misses', 'unavailable'])('one %s arm prevents advancing an otherwise complete window', gap => {
  const value = report();
  value.aiReplay.baseline.automatic--;
  value.aiReplay.baseline[gap]++;
  value.aiReplay.paired--; value.aiReplay.deterministicPairs--;
  expect(readAutomaticSourcePairReport(value)).toBe(value);
  expect(planSourcePairWindowAdvance(value, 0, 0)).toBeNull();
});

test('a valid legacy AI report remains readable but cannot grant a new cursor transition', () => {
  const value = report({ kind: 'cached' }), replay = value.aiReplay;
  replay.version = 'cached_adjudication_report.v2';
  replay.changedProposals = replay.changedDestinations;
  for (const key of ['changedDestinations', 'deterministicPairs', 'mixedPairs', 'aiPairs']) delete replay[key];
  for (const arm of [replay.baseline, replay.sourceAware]) {
    for (const key of ['automatic', 'labeledAutomatic', 'correctAutomatic', 'wrongAutomatic']) delete arm[key];
  }
  expect(readAutomaticSourcePairReport(value)).toBe(value);
  expect(planSourcePairWindowAdvance(value, 0, 0)).toBeNull();
});

test.each([
  ['empty', () => report({ eligible: 0 })], ['single window', () => report({ eligible: 25 })],
  ['partial window', () => report({ selected: 24 })], ['wrong offset', () => report({ offset: 25 })],
  ['missing cache', () => fixture.result.report], ['legacy report', () => ({ ...report(), version: 'automatic_source_pair.v1' })],
  ['invalid shape', () => ({ ...report(), private: 'secret' })], ['absent report', () => null],
])('%s does not advance', (_name, make) => { expect(planSourcePairWindowAdvance(make(), 0, 0)).toBeNull(); });

test.each([undefined, -1, 1.5, 2147483647, '1'])('invalid revision %s fails closed', revision => {
  expect(planSourcePairWindowAdvance(report(), revision, 0)).toBeNull();
});
test.each([undefined, -1, 1.5, 300, '0'])('invalid offset %s fails closed', offset => {
  expect(planSourcePairWindowAdvance(report(), 0, offset)).toBeNull();
});

function setup() {
  const snapshot = structuredClone(fixture.snapshot);
  const result = { ...fixture.result, report: report() };
  const repository = { readSnapshot: jest.fn().mockResolvedValue(structuredClone(snapshot)) };
  const evaluate = jest.fn().mockResolvedValue(result);
  return { snapshot, result, repository, evaluate, run: createProgressingSourcePairEvaluation({ repository, evaluate }) };
}
test('fresh snapshot grants only an internal intent; cursor revision is not evidence identity', async () => {
  const { run, snapshot, result, evaluate, repository } = setup(), signal = new AbortController().signal;
  expect(await run(snapshot, null, signal)).toEqual({ ...result, replayWindow: { revision: 0, selectionOffset: 0, nextOffset: 25 } });
  expect(evaluate).toHaveBeenCalledWith(snapshot, null, signal);
  expect(repository.readSnapshot).toHaveBeenCalledWith(signal);
  expect(fingerprintAutomaticSourcePairInputs({ ...snapshot, adjudicationBudgetRevision: 99 }, result)).toBe(result.fingerprint);
});
test.each(['revision', 'offset', 'source', 'configuration', 'cache'])('%s drift cannot grant advancement', async kind => {
  const { run, snapshot, result, repository } = setup();
  const current = structuredClone(snapshot);
  if (kind === 'revision') current.adjudicationBudgetRevision++;
  if (kind === 'offset') current.inputs.source.adjudicationSelectionOffset = 25;
  if (kind === 'source') current.inputs.source.rows[0].overview = 'changed';
  if (kind === 'configuration') current.inputs.configuration = 'changed';
  if (kind === 'cache') current.inputs.source.adjudicationConfig = { fingerprint: 'a'.repeat(64) };
  repository.readSnapshot.mockResolvedValue(current);
  expect(await run(snapshot, null, new AbortController().signal)).toBe(result);
});
test('no candidate avoids a second snapshot; read failure and cancellation cannot publish intent', async () => {
  const a = setup(); a.result.report = fixture.result.report;
  expect(await a.run(a.snapshot, null, new AbortController().signal)).toBe(a.result);
  expect(a.repository.readSnapshot).not.toHaveBeenCalled();
  const b = setup(); b.repository.readSnapshot.mockRejectedValue(new Error('unavailable'));
  await expect(b.run(b.snapshot, null, new AbortController().signal)).rejects.toThrow('unavailable');
  const c = setup(), controller = new AbortController();
  c.repository.readSnapshot.mockImplementation(() => { controller.abort(); return c.snapshot; });
  await expect(c.run(c.snapshot, null, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(c.result.replayWindow).toBeUndefined();
});

test.each([null, {}, { revision: 0, selectionOffset: 0, nextOffset: 50 },
  { revision: 0, selectionOffset: 0, nextOffset: 25, secret: true }])('repository rejects malformed transition %j', async window => {
  const client = { query: jest.fn() };
  await expect(advanceEvaluatedSourcePairWindow(client, 'a'.repeat(64), report(), window)).rejects.toThrow('transition_invalid');
  expect(client.query).not.toHaveBeenCalled();
});
test.each([null, 'private'])('repository rejects invalid fingerprint %s', async fingerprint => {
  const client = { query: jest.fn() };
  await expect(advanceEvaluatedSourcePairWindow(client, fingerprint, report(),
    { revision: 0, selectionOffset: 0, nextOffset: 25 })).rejects.toThrow('transition_invalid');
  expect(client.query).not.toHaveBeenCalled();
});

test.each([0, 1])('repository accepts a guarded CAS row count of %i without inference-related updates', async rowCount => {
  const client = { query: jest.fn().mockResolvedValue({ rowCount }) };
  await advanceEvaluatedSourcePairWindow(client, 'a'.repeat(64), report(), { revision: 0, selectionOffset: 0, nextOffset: 25 });
  expect(client.query).toHaveBeenCalledTimes(3);
  const [sql, parameters] = client.query.mock.calls[2];
  expect(parameters).toEqual([0, 0, 25, 'a'.repeat(64)]);
  expect(sql).toContain('revision=revision+1');
  expect(sql).not.toMatch(/daily_calls|daily_tokens|calls_reserved|tokens_reserved|next_check_at|status=/);
});
