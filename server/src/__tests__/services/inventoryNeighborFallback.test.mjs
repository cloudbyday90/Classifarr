/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { assessInventoryNeighborFallback, isInventoryNeighborFallbackTarget } from '../../services/inventoryNeighborFallback.mjs';
import { assessLearnedEvidenceReview } from '../../services/learnedEvidenceReviewResolver.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';
import { neighborFallbackFixture } from '../fixtures/inventoryNeighborFallbackFixture.mjs';

test('only replaces the neighbor veto, rechecks metadata and never grants routing authority', () => {
  const { input, evidence } = neighborFallbackFixture(), before = structuredClone({ input, evidence });
  expect(assessLearnedEvidenceReview(input).reason).toBe('neighbors_disagree');
  expect(assessInventoryNeighborFallback(input, evidence)).toMatchObject({ wouldResolve: true,
    reason: 'calibrated_evidence_agrees', automaticRouteAllowed: false, baseline: { wouldResolve: false } });
  expect({ input, evidence }).toEqual(before);
  expect(evaluateClassificationRouteSafety({ result: { ...input.result, ...assessInventoryNeighborFallback(input, evidence),
    policyResult: input.policyResult } }).automatic_route_allowed).toBe(false);
});

test('preserves strict success without requiring calibration and retains the original baseline result', () => {
  const { input } = neighborFallbackFixture(); input.reviewEvidence.candidates[0].items[0].similarity = .65;
  expect(assessInventoryNeighborFallback(input)).toEqual({ version: 'inventory_neighbor_fallback_v1',
    reason: 'strict_preserved', wouldResolve: true, automaticRouteAllowed: false, baseline: assessLearnedEvidenceReview(input) });
  input.reviewEvidence.candidates[1].learnedProfile.relativeFit = -2;
  expect(assessInventoryNeighborFallback(input).reason).toBe('metadata_disagrees');
});

test.each([
  i => { i.aiMatch = null; },
  i => { i.aiMatch.needs_clarification = true; },
  i => { i.aiMatch.ai_authority.providerId = 'remote'; },
  i => { i.requireAllConfirmations = true; },
  i => { i.metadata.tmdb_id = null; },
  i => { i.policyResult.action = 'prompt_confirm'; },
  i => { i.policyResult.decisionDiagnostics.reason_code = 'operator_hold'; },
  i => { i.policies[1].enabled = false; },
  i => { i.policies[1].trust_rag = false; },
  i => { i.policyResult.ranked[1].candidate_diagnostics.policy_constraints.failed = true; },
  i => { i.reviewEvidence.candidates.pop(); },
  i => { i.reviewEvidence.candidates[0].indexed = 1; },
  i => { i.reviewEvidence.candidates[1].items[0].sharedAcrossCandidates = true; },
])('retains non-neighbor baseline veto without bypassing explicit scope restrictions', change => {
  const { input, evidence } = neighborFallbackFixture(); change(input);
  const baseline = assessLearnedEvidenceReview(input);
  expect(baseline.wouldResolve).toBe(false);
  expect(baseline.reason).not.toBe('neighbors_disagree');
  expect(assessInventoryNeighborFallback(input, evidence)).toMatchObject({ reason: baseline.reason, wouldResolve: false, baseline });
});

test.each([0, -1, 1])('metadata must be positive and uniquely leading after neighbor overlap (%s)', fit => {
  const { input, evidence } = neighborFallbackFixture(); input.reviewEvidence.candidates[1].learnedProfile.relativeFit = fit;
  input.reviewEvidence.candidates[0].learnedProfile.relativeFit = 1;
  expect(assessInventoryNeighborFallback(input, evidence)).toMatchObject({ wouldResolve: false, reason: 'metadata_disagrees' });
});

test('candidate and full-pool calibration scope must agree; names and observed labels cannot change selection', () => {
  const { input, evidence } = neighborFallbackFixture();
  evidence.proposal.selected = 1; evidence.calibration.candidates[0].calibrated = true;
  expect(assessInventoryNeighborFallback(input, evidence).reason).toBe('ai_description_disagrees');
  evidence.proposal.selected = 2; evidence.calibration.candidates[0].libraryId = 9;
  expect(assessInventoryNeighborFallback(input, evidence).reason).toBe('calibration_scope_mismatch');
  evidence.calibration.candidates[0].libraryId = 1;
  input.libraries.reverse().forEach(library => { library.name = 'Arbitrary private name'; });
  input.observedLibraryIds = [3]; input.reviewEvidence.candidates.reverse(); evidence.calibration.candidates.reverse();
  expect(assessInventoryNeighborFallback(input, evidence).wouldResolve).toBe(true);
});

test.each([
  e => { e.proposal.selected = null; }, e => { e.proposal.strict = true; }, e => { e.proposal.shared = true; },
  e => { e.calibration = null; }, e => { e.calibration.version = 'library_neighbor_margin_v1'; },
  e => { e.calibration.snapshotId = 'invalid'; }, e => { e.calibration.status = 'failed'; },
  e => { e.calibration.candidates = []; }, e => { e.calibration.candidates = null; },
  e => { e.calibration.candidates[0] = null; },
  e => { e.calibration.candidates.push(e.calibration.candidates[0]); },
  e => { e.calibration.candidates[0].status = 'sparse'; },
  e => { e.calibration.candidates[0].referenceComplete = false; },
  e => { e.calibration.candidates[0].referenceDescriptions = 19; },
  e => { e.calibration.candidates[0].calibrationDescriptions = 33; },
  e => { e.calibration.candidates[0].minimumCalibrationReferences = 19; },
  e => { e.calibration.candidates[1].calibrated = false; },
])('fails closed on incomplete or mismatched calibration without dropping rivals', change => {
  const { input, evidence } = neighborFallbackFixture(); change(evidence);
  expect(isInventoryNeighborFallbackTarget(evidence)).toBe(false);
  expect(assessInventoryNeighborFallback(input, evidence)).toMatchObject({ reason: 'calibrated_support_unavailable', wouldResolve: false });
});

test('missing inputs fail closed', () => {
  expect(isInventoryNeighborFallbackTarget()).toBe(false);
  expect(assessInventoryNeighborFallback().wouldResolve).toBe(false);
});
