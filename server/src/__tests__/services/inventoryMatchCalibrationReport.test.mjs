/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { summarizeInventoryMatchCalibration } from '../../services/inventoryMatchCalibrationReport.mjs';

const row = (status, { selected = 1, before = true } = {}) => ({ sample: { observedLibraryIds: [1] },
  prepared: { policyResult: { ranked: [{ library_id: 1 }] }, matchCalibration: {
    version: 'library_match_baseline_v1', snapshotId: 'private-snapshot', candidates: [1, 2].map(libraryId => ({
      libraryId, status: libraryId === selected ? status : 'unusual', referenceDescriptions: 40, calibrationDescriptions: 20,
    })),
  } }, generated: { status: 'proposed', destinationId: selected, learnedReview: { wouldResolve: before } },
});

test('compares identical proposals before and after novelty, without inventing accuracy or exporting identities', () => {
  const rows = [row('familiar'), row('familiar', { selected: 2 }), row('unusual'), row('sparse'), row('degenerate'),
    row('familiar', { before: false })];
  const report = summarizeInventoryMatchCalibration(rows);
  expect(report).toMatchObject({ sampled: 6, beforeNoveltyCheck: 5, afterNoveltyCheck: 2,
    placementAgreement: 1, placementDisagreement: 1, policyLeaderDisagreement: 1,
    withheldStates: { familiar: 0, unusual: 1, sparse: 1, degenerate: 1 },
    libraryFoldModels: 2, trainedLibraryFoldModels: 2, minimumReferenceDescriptions: 40,
    minimumCalibrationDescriptions: 20, probabilityCalibrated: false, livePromotionAllowed: false });
  expect(report.proposalStates).toEqual({ familiar: 3, unusual: 1, sparse: 1, degenerate: 1 });
  expect(JSON.stringify(report)).not.toMatch(/private|destinationId|observedLibraryIds|snapshotId|libraryId/);
});

test('preflight, failure, abstention, missing selected baseline and sparse models never qualify', () => {
  const cases = [row('familiar'), row('familiar'), row('familiar'), row('familiar')];
  delete cases[0].generated;
  cases[1].generated = { status: 'failed' };
  cases[2].generated.status = 'abstained';
  cases[3].generated.destinationId = 999;
  for (const value of cases) for (const candidate of value.prepared.matchCalibration.candidates) {
    candidate.status = 'sparse'; candidate.calibrationDescriptions = 0; candidate.referenceDescriptions = 0;
  }
  expect(summarizeInventoryMatchCalibration(cases)).toMatchObject({ sampled: 4, afterNoveltyCheck: 0,
    trainedLibraryFoldModels: 0, minimumReferenceDescriptions: null, minimumCalibrationDescriptions: null });
  expect(summarizeInventoryMatchCalibration([{ prepared: {} }])).toMatchObject({ sampled: 0, libraryFoldModels: 0 });
});
