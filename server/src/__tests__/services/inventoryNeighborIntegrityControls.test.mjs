/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { evaluateNeighborIntegrityControls, summarizeNeighborIntegrityControls } from '../../services/inventoryNeighborIntegrityControls.mjs';

function fixture() {
  const contextId = 'a'.repeat(64), entry = { mediaType: 'movie', itemIdentity: { mediaType: 'movie', tmdbId: 1 },
    descriptionHash: 'b'.repeat(64), heldDescriptionHashes: new Set(['b'.repeat(64)]), foldIndex: 0 };
  const assessment = { statusId: 'challenger', policyLeaderId: 1, challengerId: 2, candidateOrder: [2, 1] };
  const calibration = { contextId,
    crossFitMatch: { version: 'library_match_cross_fit_v1', contextId, snapshotId: 'c'.repeat(64), candidates: [1, 2].map(libraryId => ({
      libraryId, status: 'familiar', empiricalRank: .8, referenceDescriptions: 23, calibrationDescriptions: 24, minimumCalibrationReferences: 23 })) },
    exactNeighbor: { version: 'library_neighbor_exact_cross_fit_v2', contextId, snapshotId: 'd'.repeat(64), status: 'evaluated', candidates: [1, 2].map(libraryId => ({
      libraryId, status: 'available', referenceComplete: true, referenceDescriptions: 24, calibrationDescriptions: 24, minimumCalibrationReferences: 23, calibrated: libraryId === 2 })) } };
  const calibrate = jest.fn(async query => { throw new Error(query.foldIndex === -1 || !query.heldDescriptionHashes.size
    ? 'leader_calibration_fold_invalid' : 'inventory_calibration_query_invalid'); });
  return { entry, assessment, calibration, calibrate };
}

test('all thirteen controls reject against a positive baseline without mutating or exposing evidence', async () => {
  const { entry, assessment, calibration, calibrate } = fixture(), before = structuredClone(calibration);
  const rows = await evaluateNeighborIntegrityControls(entry, assessment, calibration, calibrate);
  expect(summarizeNeighborIntegrityControls(rows)).toMatchObject({ status: 'passed', attempted: 13, rejected: 13,
    unexpectedAcceptance: 0, unexpectedErrors: 0, positiveBaselineControls: 13 });
  expect(calibrate).toHaveBeenCalledTimes(4); expect(calibration).toEqual(before);
  expect(JSON.stringify(rows)).not.toMatch(/tmdb|snapshotId|contextId|candidates|aaaa/);
  expect(summarizeNeighborIntegrityControls([]).status).toBe('not_exercised');
});

test('unexpected errors and wrongly admitted queries are failures, never successful rejection', async () => {
  const { entry, assessment, calibration } = fixture();
  const unexpected = await evaluateNeighborIntegrityControls(entry, assessment, calibration, async () => { throw new Error('exact_neighbor_work_budget'); });
  expect(summarizeNeighborIntegrityControls(unexpected)).toMatchObject({ status: 'failed', unexpectedErrors: 4, rejected: 9 });
  const nonError = await evaluateNeighborIntegrityControls(entry, assessment, calibration, async () => { throw null; });
  expect(summarizeNeighborIntegrityControls(nonError)).toMatchObject({ status: 'failed', unexpectedErrors: 4 });
  const admitted = await evaluateNeighborIntegrityControls(entry, assessment, calibration, async () => ({}));
  expect(summarizeNeighborIntegrityControls(admitted)).toMatchObject({ status: 'failed', unexpectedAcceptance: 4 });
  let calls = 0;
  const thrown = await evaluateNeighborIntegrityControls(entry, assessment, calibration, async () => ({}), {
    assess: () => { if (calls++) throw new Error('private'); return { accepted: true }; } });
  expect(summarizeNeighborIntegrityControls(thrown).unexpectedErrors).toBe(9);
  expect(JSON.stringify(thrown)).not.toContain('private');
});

test('cancellation interrupts instead of counting as rejected data, including during a query failure', async () => {
  const { entry, assessment, calibration, calibrate } = fixture();
  await expect(evaluateNeighborIntegrityControls(entry, assessment, calibration, calibrate, { signal: AbortSignal.abort() })).rejects.toThrow();
  const controller = new AbortController();
  await expect(evaluateNeighborIntegrityControls(entry, assessment, calibration, async () => {
    controller.abort(); throw new Error('inventory_calibration_query_invalid');
  }, { signal: controller.signal })).rejects.toThrow();
});
