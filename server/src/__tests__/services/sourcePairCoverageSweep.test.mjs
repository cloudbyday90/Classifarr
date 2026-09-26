/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, expect, jest, test } from '@jest/globals';
import { sourcePairWindowFixture, completedWindowReport } from '../fixtures/sourcePairWindowFixture.mjs';
import { selectSourcePairSweepSnapshot, planSourcePairSweepAdvance, sameSourcePairSweepCursor } from '../../services/sourcePairCoverageSweep.mjs';
import { readSourcePairSweepCursor, advanceSourcePairSweep } from '../../services/sourcePairCoverageSweepRepository.mjs';
import { createProgressingSourcePairEvaluation } from '../../services/sourcePairWindowProgression.mjs';
import { fingerprintAutomaticSourcePairInputs, fingerprintSourcePairEvidence } from '../../services/automaticSourcePairComputation.mjs';

let fixture;
beforeAll(async () => { fixture = await sourcePairWindowFixture(); });
const scope = 'a'.repeat(64);
const cursor = (selectionOffset = 0, evidenceRevision = scope, revision = 0) => ({ revision, selectionOffset, evidenceRevision });
const report = options => completedWindowReport(fixture.result.report, options);

test.each(['misses', 'unavailable'])('survey advances over %s without treating gaps as pairs', gap => {
  const value = report();
  value.aiReplay.baseline.automatic--; value.aiReplay.baseline[gap]++;
  value.aiReplay.paired--; value.aiReplay.deterministicPairs--;
  expect(planSourcePairSweepAdvance(value, cursor(), scope)).toEqual({ ...cursor(), nextOffset: 25, nextEvidenceRevision: scope });
});

test('tail, drift and population shrink normalize safely; empty/single windows settle without writes', () => {
  expect(planSourcePairSweepAdvance(report({ offset: 25 }), cursor(25), scope)?.nextOffset).toBe(0);
  expect(planSourcePairSweepAdvance(report(), cursor(25, 'b'.repeat(64)), scope)?.nextOffset).toBe(25);
  expect(planSourcePairSweepAdvance(report(), cursor(299), scope)?.nextOffset).toBe(25);
  for (const eligible of [0, 20, 25]) {
    expect(planSourcePairSweepAdvance(report({ eligible }), cursor(), scope)).toBeNull();
    expect(planSourcePairSweepAdvance(report({ eligible }), cursor(25), scope)?.nextOffset).toBe(0);
    expect(planSourcePairSweepAdvance(report({ eligible }), cursor(0, null), scope)?.nextEvidenceRevision).toBe(scope);
  }
});

test.each([null, {}, cursor(-1), cursor(300), cursor(0, 'private'), cursor(0, scope, -1), cursor(0, scope, 2147483647)])(
  'invalid cursor %j fails closed', value => {
    expect(planSourcePairSweepAdvance(report(), value, scope)).toBeNull();
    expect(sameSourcePairSweepCursor(value, cursor())).toBeFalsy();
    if (value) expect(() => selectSourcePairSweepSnapshot({ ...fixture.snapshot, sweepCursor: value }, null)).toThrow('cursor_invalid');
  });

test.each([null, { version: 'invalid' }, 'partial', 'wrong_offset', 'legacy'])('invalid/incomplete report %j cannot move the survey', kind => {
  const value = kind === 'partial' ? report({ selected: 24 }) : kind === 'wrong_offset' ? report({ offset: 25 })
    : kind === 'legacy' ? { ...report(), version: 'automatic_source_pair.v1' } : kind;
  expect(planSourcePairSweepAdvance(value, cursor(), scope)).toBeNull();
});

test('selection leaves capture untouched; response backfill/expiry does not reset stable scope', () => {
  expect(selectSourcePairSweepSnapshot(fixture.snapshot, null)).toBe(fixture.snapshot);
  const snapshot = structuredClone(fixture.snapshot);
  const evidenceRevision = fingerprintSourcePairEvidence(snapshot, fixture.result);
  snapshot.sweepCursor = cursor(25, evidenceRevision);
  const selected = selectSourcePairSweepSnapshot(snapshot, null, fixture.result);
  expect(selected.inputs.source.adjudicationSelectionOffset).toBe(25);
  expect(snapshot.inputs.source.adjudicationSelectionOffset).toBe(0);
  snapshot.inputs.source.adjudicationBatch = { intentionallyIgnored: 'cache content' };
  expect(selectSourcePairSweepSnapshot(snapshot, null, fixture.result).sweepEvidenceRevision).toBe(evidenceRevision);
  snapshot.inputs.source.adjudicationBatch = null;
  expect(selectSourcePairSweepSnapshot(snapshot, null, fixture.result).inputs.source.adjudicationSelectionOffset).toBe(25);
  snapshot.inputs.configuration = 'changed';
  expect(selectSourcePairSweepSnapshot(snapshot, null, fixture.result).inputs.source.adjudicationSelectionOffset).toBe(0);
});

test.each(['source', 'policy', 'labels', 'configuration', 'cohort_expiry'])('%s change restarts the sweep scope', kind => {
  const snapshot = structuredClone(fixture.snapshot), state = { cohort: fixture.result.cohort, cohort_created_at: fixture.result.cohortCreatedAt };
  snapshot.sweepCursor = cursor(25, fingerprintSourcePairEvidence(snapshot, fixture.result));
  if (kind === 'source') snapshot.inputs.source.rows[0].title = 'Changed source';
  if (kind === 'policy') snapshot.inputs.source.policies[0].priority++;
  if (kind === 'labels') snapshot.inputs.source.operatorFeedbackRows.push({ id: 'changed' });
  if (kind === 'configuration') snapshot.inputs.configuration = 'changed';
  if (kind === 'cohort_expiry') state.cohort_created_at = new Date(Date.parse(snapshot.observedAt) - 31 * 86400000).toISOString();
  // An expired cohort gets a new creation date, even when membership remains identical.
  if (kind === 'cohort_expiry') snapshot.observedAt = new Date(Date.parse(snapshot.observedAt) + 1000).toISOString();
  expect(selectSourcePairSweepSnapshot(snapshot, state).inputs.source.adjudicationSelectionOffset).toBe(0);
});

function setup() {
  const snapshot = structuredClone(fixture.snapshot);
  snapshot.sweepCursor = cursor(0, null);
  const result = { ...fixture.result, report: report() };
  const repository = { readSnapshot: jest.fn().mockResolvedValue(structuredClone(snapshot)) };
  const evaluate = jest.fn().mockResolvedValue(result);
  return { snapshot, result, repository, evaluate, run: createProgressingSourcePairEvaluation({ repository, evaluate }) };
}

test('new scope and reread use the same frozen cohort date, with separate capture and survey intents', async () => {
  const { run, snapshot, repository } = setup();
  repository.readSnapshot.mockResolvedValue({ ...snapshot, observedAt: new Date(Date.parse(snapshot.observedAt) + 1000).toISOString() });
  const result = await run(snapshot, null, new AbortController().signal);
  expect(result).toMatchObject({ replayWindow: { revision: 0, selectionOffset: 0, nextOffset: 25 },
    sweepWindow: { revision: 0, selectionOffset: 0, evidenceRevision: null, nextOffset: 25 } });
  expect(result.sweepWindow.nextEvidenceRevision).toBe(fingerprintSourcePairEvidence(snapshot, result));
});

test.each(['capture_revision', 'capture_offset'])('%s drift fences only capture, not the independent survey', async kind => {
  const { run, snapshot, repository } = setup();
  const current = structuredClone(snapshot);
  if (kind === 'capture_revision') current.adjudicationBudgetRevision++;
  else current.inputs.source.adjudicationSelectionOffset = 25;
  repository.readSnapshot.mockResolvedValue(current);
  const result = await run(snapshot, null, new AbortController().signal);
  expect(result.replayWindow).toBeUndefined(); expect(result.sweepWindow.nextOffset).toBe(25);
});

test.each(['revision', 'offset', 'scope', 'absent', 'source'])('%s drift fences survey advancement', async kind => {
  const { run, snapshot, result, repository } = setup();
  const current = structuredClone(snapshot);
  if (kind === 'revision') current.sweepCursor.revision++;
  if (kind === 'offset') current.sweepCursor.selectionOffset = 25;
  if (kind === 'scope') current.sweepCursor.evidenceRevision = scope;
  if (kind === 'absent') delete current.sweepCursor;
  if (kind === 'source') current.inputs.source.rows[0].title = 'Changed source';
  repository.readSnapshot.mockResolvedValue(current);
  expect(await run(snapshot, null, new AbortController().signal)).toBe(result);
});

test('diagnostic window can advance independently of an unfinished capture window', async () => {
  const { run, snapshot, result, repository } = setup();
  snapshot.sweepCursor = cursor(25, fingerprintSourcePairEvidence(snapshot, result));
  result.report = report({ offset: 25 });
  result.fingerprint = fingerprintAutomaticSourcePairInputs(selectSourcePairSweepSnapshot(snapshot, null, result), result);
  repository.readSnapshot.mockResolvedValue(snapshot);
  const value = await run(snapshot, null, new AbortController().signal);
  expect(value.replayWindow).toBeUndefined(); expect(value.sweepWindow.nextOffset).toBe(0);
});

test('abort during fresh reread cannot produce either intent', async () => {
  const { run, snapshot, repository } = setup(), controller = new AbortController();
  repository.readSnapshot.mockImplementation(() => { controller.abort(); return snapshot; });
  await expect(run(snapshot, null, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

test('repository reads a default cursor for fresh installs or a persisted checkpoint', async () => {
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [cursor(25)] }) };
  expect(await readSourcePairSweepCursor(client)).toEqual(cursor(0, null));
  expect(await readSourcePairSweepCursor(client)).toEqual(cursor(25));
});

test.each([null, {}, { ...cursor(), nextOffset: 50, nextEvidenceRevision: scope },
  { ...cursor(), nextOffset: 25, nextEvidenceRevision: scope, secret: true }])('repository rejects malformed transition %j', async window => {
  const client = { query: jest.fn() };
  await expect(advanceSourcePairSweep(client, report(), window)).rejects.toThrow('transition_invalid');
  expect(client.query).not.toHaveBeenCalled();
});

test.each([0, 1])('repository accepts CAS row count %i and never writes capture state', async rowCount => {
  const client = { query: jest.fn().mockResolvedValue({ rowCount }) };
  expect(await advanceSourcePairSweep(client, report(), { ...cursor(), nextOffset: 25, nextEvidenceRevision: scope })).toBe(rowCount === 1);
  expect(client.query).toHaveBeenCalledTimes(2);
  expect(client.query.mock.calls[1][1]).toEqual([0, 0, scope, 25, scope]);
  expect(client.query.mock.calls[1][0]).toContain('evidence_revision IS NOT DISTINCT FROM $3');
  expect(client.query.mock.calls.flat().join(' ')).not.toContain('adjudication_capture_budget');
});
