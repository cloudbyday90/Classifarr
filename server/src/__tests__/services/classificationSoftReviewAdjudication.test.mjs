/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { ClassificationPolicyPathService } from '../../services/classificationPolicyPathService.mjs';
import { createLearnedEvidenceRoutingService } from '../../services/learnedEvidenceRoutingService.mjs';
import { createPolicyCandidateConsensusService } from '../../services/policyCandidateConsensusService.mjs';
import { buildPolicyCandidateAdjudicationContract } from '../../services/policyCandidateAdjudicationContract.mjs';
import { projectPolicyCandidateDecision } from '../../services/policyCandidateDecisionProjection.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';
import { consensusDependencies } from '../fixtures/policyCandidateConsensusFixture.mjs';
import { learnedRoutingDependencies, learnedRoutingFixture } from '../fixtures/learnedEvidenceRoutingFixture.mjs';

function setup(kind = 'agrees') {
  const input = learnedRoutingFixture();
  Object.assign(input.policyResult, projectPolicyCandidateDecision({ ranked: input.policyResult.ranked }));
  expect(input.policyResult).toMatchObject({ action: 'manual', decisionDiagnostics: { reason_code: 'weak_evidence_overlap' } });
  if (kind === 'hard_hold') input.policyResult.decisionDiagnostics.reason_code = 'operator_hold';
  input.contract = buildPolicyCandidateAdjudicationContract({ policyResult: input.policyResult,
    libraries: input.libraries, mediaType: input.metadata.media_type });
  const deps = learnedRoutingDependencies(input), readConfig = deps.readConfig;
  if (kind === 'confirmation') deps.readConfig = async () => ({ ...(await readConfig()), confirmation_setting: 'true' });
  if (kind === 'unavailable') deps.retriever.retrieve = async () => ({ statusId: 'unavailable', candidates: [] });
  if (kind === 'neighbors') input.reviewEvidence.candidates[0].items[0].similarity = 1;
  if (kind === 'identity') input.reviewEvidence.candidates[0].queryIdentityPresent = true;
  if (kind === 'metadata') input.reviewEvidence.candidates[1].learnedProfile.relativeFit = -1;
  if (kind === 'unfamiliar') input.reviewEvidence.candidates[1].matchBaseline.status = 'unusual';
  if (kind === 'stale') deps.readPolicy = async () => ({ ...input.policyResult,
    ranked: input.policyResult.ranked.map(candidate => ({ ...candidate, score: candidate.score + 1 })),
  });
  if (kind === 'fallback') input.aiMatch.ai_authority.isFallback = true;
  if (kind === 'remote') input.aiMatch.ai_authority.providerId = 'remote';
  if (kind === 'abstention') input.aiMatch.needs_clarification = true;
  if (kind === 'missing_contract') input.contract = { valid: false, candidates: [] };
  const aiClassify = jest.fn(async () => input.aiMatch);
  const learned = createLearnedEvidenceRoutingService(deps);
  const service = new ClassificationPolicyPathService({
    policyEngine: { evaluateItem: async () => input.policyResult },
    policyScoringContextBuilder: { buildSignalContext: () => ({ confidence: 45 }) },
    policyCandidateShortlistService: { build: async () => input.contract },
    classificationAiService: { aiClassify },
    policyCandidateAdjudicationEvidenceService: { build: async () => input.evidence },
    policyCandidateConsensusService: createPolicyCandidateConsensusService(consensusDependencies(input)),
    learnedEvidenceRoutingService: learned,
    policyCandidateContrastiveRetriever: { retrieve: async () => null },
    classificationRoutingService: { ensureDecisionQuestion: async ({ result }) => result },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  return { input, service, aiClassify, learned };
}

test('ordinary weak-overlap classification reaches the existing fresh-evidence resolver in one comparison', async () => {
  const { input, service, aiClassify } = setup();
  const before = structuredClone(input.policyResult);
  const { result } = await service.execute({ metadata: input.metadata, libraries: input.libraries });
  expect(aiClassify).toHaveBeenCalledTimes(1);
  expect(aiClassify).toHaveBeenCalledWith(input.metadata, input.contract.candidates.map(row => row.library),
    expect.any(Object), expect.objectContaining({ mode: 'adjudicate' }));
  expect(result).toMatchObject({ method: 'library_consensus_auto', confidence: 45, needs_clarification: false });
  expect(input.policyResult).toEqual(before);
  expect(hasCandidateConsensusReceipt(result, { metadata: input.metadata })).toBe(true);
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(true);
  expect(evaluateClassificationRouteSafety({ result, requireAllConfirmations: true }).automatic_route_allowed).toBe(false);
  expect(hasCandidateConsensusReceipt(JSON.parse(JSON.stringify(result)))).toBe(false);
});

test.each(['confirmation', 'unavailable', 'neighbors', 'identity', 'metadata', 'unfamiliar', 'stale',
  'fallback', 'remote', 'abstention', 'hard_hold', 'missing_contract'])(
  'weak-overlap comparison cannot bypass %s', async kind => {
    const { input, service, aiClassify, learned } = setup(kind);
    const { result } = await service.execute({ metadata: input.metadata, libraries: input.libraries });
    expect(aiClassify).toHaveBeenCalledTimes(['hard_hold', 'missing_contract'].includes(kind) ? 0 : 1);
    expect(result.needs_clarification).toBe(true);
    expect(input.policyResult.decisionDiagnostics.requires_manual_review).toBe(true);
    expect(hasCandidateConsensusReceipt(result)).toBe(false);
    expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
    if (kind === 'confirmation') expect(learned.shadowStatus().counts).toMatchObject({
      prepared_admin_held: 1, strict_qualified_admin_held: 1,
    });
  });
