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
    familiarPlacementAgreement: 1, familiarPlacementDisagreement: 1, livePromotionAllowed: false,
    familiarityWithheldStates: { unusual: 1, sparse: 0, degenerate: 0, unavailable: 0 } });
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

test('separates scarce, unusual, degenerate and unavailable evidence without exporting arbitrary status text', () => {
  const cases = ['sparse', 'unusual', 'degenerate', 'private invalid status', 'missing_candidate', 'wrong_version'].map(status => {
    const value = row(true, false);
    value.prepared.matchCalibration.candidates[0].status = status;
    if (status === 'missing_candidate') value.prepared.matchCalibration.candidates = [];
    if (status === 'wrong_version') value.prepared.matchCalibration.version = 'private invalid version';
    return value;
  });
  const result = summarizeInventoryNeighborFallback(cases);
  expect(result).toMatchObject({ additionalReviewResolutions: 6, afterFamiliarityCheck: 0,
    familiarityWithheldStates: { unusual: 1, sparse: 1, degenerate: 1, unavailable: 3 },
    strictControlsEvaluated: 0, comparisonScope: 'fallback_targets_only' });
  expect(Object.values(result.familiarityWithheldStates).reduce((sum, count) => sum + count, 0))
    .toBe(result.additionalReviewResolutions - result.afterFamiliarityCheck);
  expect(JSON.stringify(result)).not.toContain('private');
});

test('counts strict controls separately from fallback targets, including any strict loss', () => {
  const controls = [true, false].map(wouldResolve => {
    const value = row(true, true);
    value.prepared.neighborFallback.proposal.strict = true;
    value.generated.neighborFallback.baseline.wouldResolve = true;
    value.generated.neighborFallback.wouldResolve = wouldResolve;
    return value;
  });
  const untested = row(true, true);
  untested.prepared.neighborFallback.proposal.strict = true;
  delete untested.generated;
  expect(summarizeInventoryNeighborFallback([row(true, true), ...controls, untested])).toMatchObject({
    selected: 1, evaluated: 1, strictNeighborSupported: 3, strictControlsEvaluated: 2,
    comparisonScope: 'includes_strict_controls', strictPreserved: 1, strictLost: 1,
    additionalReviewResolutions: 1, afterFamiliarityCheck: 1,
  });
});
