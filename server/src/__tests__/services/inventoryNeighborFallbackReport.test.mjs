/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { summarizeInventoryNeighborFallback } from '../../services/inventoryNeighborFallbackReport.mjs';
import { assessInventoryNeighborFallback } from '../../services/inventoryNeighborFallback.mjs';
import { neighborFallbackFixture } from '../fixtures/inventoryNeighborFallbackFixture.mjs';

const row = (agreement, familiar) => {
  const { input, evidence } = neighborFallbackFixture();
  return { sample: { observedLibraryIds: [agreement ? 2 : 3] }, prepared: { status: 'ready', neighborFallback: evidence,
    matchCalibration: { version: 'library_match_baseline_v1', candidates: [{ libraryId: 2, status: familiar ? 'familiar' : 'unusual' }] } },
  generated: { status: 'proposed', destinationId: 2, neighborFallback: assessInventoryNeighborFallback(input, evidence) } };
};

test('separates targeted, generated, jointly assessed and familiarity-qualified gains', () => {
  const incomplete = row(true, true); delete incomplete.generated;
  const outside = row(false, false); outside.prepared.neighborFallback.proposal.strict = true;
  const report = summarizeInventoryNeighborFallback([row(true, true), row(false, true), row(true, false), incomplete, outside]);
  expect(report).toMatchObject({ sampled: 5, strictNeighborSupported: 1, selected: 4, adjudicationReady: 4,
    generationsFinished: 3, evaluated: 3, additionalReviewResolutions: 3, strictLost: 0,
    additionalPlacementAgreement: 2, additionalPlacementDisagreement: 1, afterFamiliarityCheck: 2,
    familiarPlacementAgreement: 1, familiarPlacementDisagreement: 1, livePromotionAllowed: false });
  expect(JSON.stringify(report)).not.toMatch(/libraryId|destinationId|observedLibraryIds|snapshotId|description/);
});

test('reports changed proposals, retained strict results, failures and missing familiarity separately', () => {
  const changed = row(false, false); changed.generated.destinationId = 1;
  changed.generated.neighborFallback.wouldResolve = false; changed.generated.neighborFallback.reason = 'ai_description_disagrees';
  const preserved = row(true, true); preserved.generated.neighborFallback.baseline.wouldResolve = true;
  const failed = row(true, true); failed.generated = { status: 'failed' };
  const missing = row(true, true); delete missing.prepared.matchCalibration;
  expect(summarizeInventoryNeighborFallback([changed, preserved, failed, missing])).toMatchObject({ selected: 4,
    generationsFinished: 4, evaluated: 3, aiProposalChanged: 1, strictPreserved: 1, strictLost: 0,
    additionalReviewResolutions: 1, afterFamiliarityCheck: 0 });
  expect(summarizeInventoryNeighborFallback([])).toMatchObject({ selected: 0, evaluated: 0, reasons: {} });
});
