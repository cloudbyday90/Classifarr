/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { summarizeLearnedEvidenceReviews } from '../../services/learnedEvidenceReviewReport.mjs';
import { reducePolicyShortlistReplayResponse } from '../../services/policyShortlistReplay.mjs';
import { buildFreshPolicyReport } from '../../services/freshInventoryPolicyReport.mjs';
import { learnedReviewFixture } from '../fixtures/learnedEvidenceReviewFixture.mjs';

const row = (wouldResolve, consensusEligible, destinationId = 2) => ({
  sample: { observedLibraryIds: [2] }, prepared: { policyResult: { ranked: [{ library_id: 1 }] } },
  generated: { destinationId, consensusEligible, learnedReview: { version: 'learned_evidence_review_v1',
    wouldResolve, reason: wouldResolve ? 'learned_evidence_agrees' : 'neighbors_disagree' } },
});

test('reports added, lost and overlapping eligibility without calling placement agreement accuracy', () => {
  const report = summarizeLearnedEvidenceReviews([row(true, true), row(true, false), row(true, false, 1),
    row(false, true), row(false, false), { sample: {}, prepared: {}, generated: { status: 'failed' } }, { prepared: {} }]);
  expect(report).toEqual({ version: 'learned_evidence_review_v1', evaluated: 5, wouldResolve: 3, wouldRetainReview: 2,
    placementAgreement: 2, placementDisagreement: 1, additionalResolutions: 2,
    additionalPlacementAgreement: 1, additionalPlacementDisagreement: 1, baselineOnly: 1, both: 1,
    policyLeaderDisagreement: 2, reasons: { learned_evidence_agrees: 3, neighbors_disagree: 2 },
    calibrated: false, livePromotionAllowed: false });
  expect(summarizeLearnedEvidenceReviews([])).toMatchObject({ evaluated: 0, wouldResolve: 0, reasons: {} });
});

test('paired reducers reuse the exact same parsed proposal and never serialize private evidence', () => {
  const input = learnedReviewFixture();
  const entry = { ...input, reviewPolicies: input.policies,
    arms: { protected: { contract: input.contract, evidence: input.evidence } } };
  const reduced = reducePolicyShortlistReplayResponse(entry, 'protected',
    { response: '{"decision":"PROPOSE","library_number":2}', latencyMs: 5, promptTokens: 100, outputTokens: 8 }, { model: 'test:latest' });
  expect(reduced).toMatchObject({ status: 'proposed', destinationId: 2, consensusEligible: false, automaticRouteAllowed: false,
    learnedReview: { wouldResolve: true, automaticRouteAllowed: false }, latencyMs: 5 });
  const serialized = JSON.stringify(reduced);
  for (const privateValue of ['Example', 'Library', 'description', 'ranked', 'policy_constraints']) expect(serialized).not.toContain(privateValue);
  for (const response of ['{"decision":"ABSTAIN","library_number":null}', 'private invalid output']) {
    expect(reducePolicyShortlistReplayResponse(entry, 'protected', { response }, { model: 'test:latest' }))
      .toMatchObject({ learnedReview: { wouldResolve: false, reason: 'provider_proposal_unavailable' } });
  }
});

test('invalidated and preflight reports cannot grant live promotion', () => {
  const report = buildFreshPolicyReport({ source: { fingerprint: 'x', libraries: [] }, prepared: {}, rows: [],
    options: { size: 1, generateCases: 0 }, calls: 0, representation: {}, interrupted: false,
    verificationFailure: 'source_changed', changedComponents: ['policies'] });
  expect(report).toMatchObject({ status: 'invalidated', evaluationSnapshotValid: false,
    learnedReview: { evaluated: 0, livePromotionAllowed: false }, liveRoutingChanged: false, routingReceiptsCreated: 0 });
});
