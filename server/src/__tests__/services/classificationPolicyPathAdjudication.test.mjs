/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import { ClassificationPolicyPathService } from '../../services/classificationPolicyPathService.mjs';
import { createPolicyCandidateShortlistService } from '../../services/policyCandidateShortlistService.mjs';
import { createPolicyCandidateConsensusService } from '../../services/policyCandidateConsensusService.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';
import { consensusDependencies, consensusFixture } from '../fixtures/policyCandidateConsensusFixture.mjs';
import { createLearnedEvidenceRoutingService } from '../../services/learnedEvidenceRoutingService.mjs';
import { learnedRoutingDependencies, learnedRoutingFixture } from '../fixtures/learnedEvidenceRoutingFixture.mjs';

const libraries = [
  { id: 1, name: 'Movies', media_type: 'movie' },
  { id: 2, name: 'Family', media_type: 'movie' },
  { id: 3, name: 'Unrelated', media_type: 'movie' },
];

test('ordinary review carries learned qualification through the live policy path without an extra AI call', async () => {
  const input = learnedRoutingFixture(), dependencies = learnedRoutingDependencies(input);
  const aiClassify = jest.fn(async () => input.aiMatch);
  const service = new ClassificationPolicyPathService({
    policyEngine: { evaluateItem: async () => input.policyResult },
    policyScoringContextBuilder: { buildSignalContext: () => ({ confidence: 45 }) },
    policyCandidateShortlistService: { build: async () => input.contract },
    classificationAiService: { aiClassify },
    policyCandidateAdjudicationEvidenceService: { build: async () => input.evidence },
    policyCandidateConsensusService: createPolicyCandidateConsensusService(consensusDependencies(input)),
    learnedEvidenceRoutingService: createLearnedEvidenceRoutingService(dependencies),
    policyCandidateContrastiveRetriever: { retrieve: async () => null },
    classificationRoutingService: { ensureDecisionQuestion: async ({ result }) => {
      expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(true);
      return result;
    } },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  const outcome = await service.execute({ metadata: input.metadata, libraries: input.libraries });
  expect(outcome.result).toMatchObject({ method: 'library_consensus_auto', confidence: 45, needs_clarification: false });
  expect(hasCandidateConsensusReceipt(outcome.result, { metadata: input.metadata })).toBe(true);
  expect(aiClassify).toHaveBeenCalledTimes(1);
});

test('threshold-qualified comparison carries fresh server consensus through the policy path', async () => {
  const input = consensusFixture(), dependencies = consensusDependencies(input);
  const buildEvidence = jest.fn(dependencies.readEvidence);
  const service = new ClassificationPolicyPathService({
    policyEngine: { evaluateItem: async () => input.policyResult },
    policyScoringContextBuilder: { buildSignalContext: () => ({ confidence: 87 }) },
    policyCandidateShortlistService: { build: async () => input.contract },
    classificationAiService: { aiClassify: async () => input.aiMatch },
    policyCandidateAdjudicationEvidenceService: { build: buildEvidence },
    policyCandidateConsensusService: createPolicyCandidateConsensusService({ ...dependencies, readEvidence: buildEvidence }),
    policyCandidateContrastiveRetriever: { retrieve: async () => null },
    classificationRoutingService: { ensureDecisionQuestion: async ({ result }) => {
      expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(true);
      return result;
    } },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  const outcome = await service.execute({ metadata: input.metadata, libraries: input.libraries });
  expect(outcome.result).toMatchObject({ method: 'library_consensus_auto', confidence: 86, needs_clarification: false });
  expect(hasCandidateConsensusReceipt(outcome.result, { metadata: input.metadata })).toBe(true);
  expect(buildEvidence).toHaveBeenCalledTimes(2);
});

test('learned shortlist reaches AI and identity comparison without changing policy authority', async () => {
  const available = [...libraries, { id: 4, name: 'Fourth library', media_type: 'movie' }];
  const policyResult = { action: 'prompt_select', confidence: 45,
    decisionDiagnostics: { requires_manual_review: true, reason_code: 'weak_evidence_primary' },
    ranked: available.map(library => ({ library_id: library.id, score: 45 })) };
  const before = structuredClone(policyResult);
  const aiClassify = jest.fn(async () => ({ library: available[3], format: 'confident', confidence: 99 }));
  const retrieve = jest.fn(async () => null);
  const service = new ClassificationPolicyPathService({
    policyEngine: { evaluateItem: async () => policyResult },
    policyScoringContextBuilder: { buildSignalContext: () => ({ confidence: 45 }) },
    policyCandidateShortlistService: createPolicyCandidateShortlistService({ repository: {
      readConfig: async () => ({ rag_enabled: true }),
      readLearnedProfiles: async () => new Map(available.map(({ id }) => [id, { version: 'contrastive_profile_v1',
        snapshotId: 'a'.repeat(64), trainingDescriptions: 100, statusId: 'available', relativeFit: id === 4 ? 1 : -1 }])),
    } }),
    classificationAiService: { aiClassify },
    policyCandidateAdjudicationEvidenceService: { build: async ({ contract }) => ({ candidates: contract.candidates }) },
    policyCandidateContrastiveRetriever: { retrieve },
    classificationRoutingService: { ensureDecisionQuestion: async ({ result }) => result },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  const outcome = await service.execute({ metadata: { tmdb_id: 999, media_type: 'movie', overview: 'Synopsis', genres: ['Pattern'] }, libraries: available });
  expect(aiClassify.mock.calls[0][1].map(library => library.id)).toEqual([1, 4, 2]);
  expect(retrieve.mock.calls[0][0].contract.candidates.map(candidate => candidate.libraryId)).toEqual([1, 4, 2]);
  expect(outcome.result).toMatchObject({ confidence: 45, needs_clarification: true,
    candidate_adjudication: { statusId: 'proposed', candidateCount: 3, proposedDestination: { library_id: 4 } } });
  expect(policyResult).toEqual(before);
});

describe('ClassificationPolicyPathService candidate adjudication', () => {
  test.each([
    ['an ambiguous policy selection', 'prompt_select'],
    ['a weak manual policy outcome', 'manual'],
  ])('sends only bounded candidates to AI for %s and preserves operator routing authority', async (_label, action) => {
    const selectedCandidates = [
      { library: libraries[0], libraryId: 1, libraryNumber: 1, policyScore: 71 },
      { library: libraries[1], libraryId: 2, libraryNumber: 2, policyScore: 69 },
    ];
    const policyResult = {
      action,
      confidence: 71,
      ranked: [
        { library_id: 1, score: 71 },
        { library_id: 2, score: 69 },
      ],
    };
    const aiClassify = jest.fn().mockResolvedValue({
      library: libraries[1],
      format: 'confident',
      confidence: 95,
      reason: 'not retained',
    });
    const ensureDecisionQuestion = jest.fn(async ({ result }) => ({ ...result, normalized: true }));
    const ragLoop = jest.fn();
    const service = new ClassificationPolicyPathService({
      policyEngine: { evaluateItem: jest.fn().mockResolvedValue(policyResult) },
      policyScoringContextBuilder: {
        buildSignalContext: jest.fn().mockReturnValue({ confidence: 71, suggestedLibrary: libraries[0] }),
      },
      ragRetriever: { getSuggestedLibrary: jest.fn() },
      classificationAiService: { aiClassify },
      classificationRagLoopService: { run: ragLoop },
      classificationRoutingService: { ensureDecisionQuestion },
      buildPolicyCandidateAdjudicationContract: jest.fn().mockReturnValue({
        valid: true,
        candidates: selectedCandidates,
      }),
      policyCandidateAdjudicationEvidenceService: {
        build: jest.fn().mockResolvedValue({
          version: 'policy.candidate_adjudication.v1',
          candidates: [],
          currentLibraryCandidateRetrievalTelemetry: {
            version: 'current_library.candidate_retrieval_telemetry.v1',
            status_id: 'available',
            latency_band: 'under_25ms',
            candidate_count: 2,
            matched_candidate_count: 1,
            direct_match_candidate_count: 1,
          },
          currentLibraryCandidateSemanticRetrievalStatusId: 'available',
          currentLibraryCandidateSemanticOutcomeCalibrationStatusId: 'outcome_calibrated',
        }),
      },
      finalizePolicyCandidateAdjudication: jest.fn().mockReturnValue({
        library: libraries[1],
        confidence: 71,
        needs_clarification: true,
        method: 'policy_candidate_adjudication',
        candidate_adjudication: { statusId: 'proposed', candidateCount: 2 },
      }),
      buildPolicyCandidateContrastiveRetrievalContract: jest.fn().mockReturnValue({
        valid: true,
        candidates: [{ libraryId: 1 }, { libraryId: 2 }],
      }),
      policyCandidateContrastiveRetriever: {
        retrieve: jest.fn().mockResolvedValue({
          version: 'policy.candidate_contrastive_retrieval.v1',
          statusId: 'available',
          matchedLibraryIds: [2],
        }),
      },
      buildPolicyCandidateContrastiveEvidence: jest.fn().mockReturnValue({
        version: 'policy.candidate_contrastive_evidence.v1',
        provenance_id: 'exact_tmdb_current_library_inventory',
        status_id: 'alternative_identity_match',
      }),
      classificationProgressStageService: { updateStage: jest.fn() },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    const outcome = await service.execute({
      metadata: { title: 'Range of Stars', media_type: 'movie' },
      libraries,
    });

    expect(aiClassify).toHaveBeenCalledWith(
      expect.any(Object),
      [libraries[0], libraries[1]],
      expect.any(Object),
      expect.objectContaining({ mode: 'adjudicate' }),
    );
    expect(service.policyCandidateAdjudicationEvidenceService.build).toHaveBeenCalledWith(expect.objectContaining({
      contract: expect.any(Object),
      ragContext: null,
      metadata: expect.objectContaining({ title: 'Range of Stars', media_type: 'movie' }),
    }));
    expect(service.finalizePolicyCandidateAdjudication).toHaveBeenCalledWith(expect.objectContaining({
      semanticRetrievalStatusId: 'available',
      semanticOutcomeCalibrationStatusId: 'outcome_calibrated',
    }));
    expect(service.policyCandidateContrastiveRetriever.retrieve).toHaveBeenCalledWith({
      contract: expect.any(Object),
    });
    expect(ensureDecisionQuestion).toHaveBeenCalledWith(expect.objectContaining({
      policyResult,
      libraries,
      result: expect.objectContaining({ needs_clarification: true }),
    }));
    expect(ragLoop).not.toHaveBeenCalled();
    expect(outcome.result).toMatchObject({
      normalized: true,
      needs_clarification: true,
      current_library_candidate_retrieval_telemetry: {
        latency_band: 'under_25ms',
        direct_match_candidate_count: 1,
      },
      candidate_contrastive_evidence: {
        status_id: 'alternative_identity_match',
      },
    });
  });

  test('compares the same bounded alternatives when strict verification abstains', async () => {
    const selectedCandidates = [
      { library: libraries[1], libraryId: 2, libraryNumber: 1, policyScore: 62 },
      { library: libraries[0], libraryId: 1, libraryNumber: 2, policyScore: 45 },
    ];
    const policyResult = {
      action: 'prompt_confirm',
      confidence: 62,
      library: { library_id: 2, library_name: 'Family' },
      ranked: [
        { library_id: 2, score: 62 },
        { library_id: 1, score: 45 },
      ],
    };
    const aiClassify = jest.fn()
      .mockResolvedValueOnce({
        library: libraries[1],
        format: 'verify_advisory',
        needs_clarification: true,
        candidate_bound_verification: {
          version: 'classification.candidate_bound_verification.v1',
          status_id: 'abstained',
        },
      })
      .mockResolvedValueOnce({
        library: libraries[0],
        format: 'confident',
        needs_clarification: false,
      });
    const ensureDecisionQuestion = jest.fn(async ({ result }) => ({ ...result, normalized: true }));
    const finalizePolicyCandidateAdjudication = jest.fn().mockReturnValue({
      library: libraries[0],
      confidence: 62,
      needs_clarification: true,
      method: 'policy_candidate_adjudication',
      candidate_adjudication: { statusId: 'proposed', candidateCount: 2 },
    });
    const service = new ClassificationPolicyPathService({
      policyEngine: { evaluateItem: jest.fn().mockResolvedValue(policyResult) },
      policyScoringContextBuilder: {
        buildSignalContext: jest.fn().mockReturnValue({ confidence: 62, suggestedLibrary: libraries[1] }),
      },
      ragRetriever: { getSuggestedLibrary: jest.fn() },
      classificationAiService: { aiClassify },
      classificationRagLoopService: { run: jest.fn() },
      classificationRoutingService: { ensureDecisionQuestion },
      buildPolicyCandidateAdjudicationContract: jest.fn().mockReturnValue({
        valid: true,
        candidates: selectedCandidates,
      }),
      policyCandidateAdjudicationEvidenceService: {
        build: jest.fn().mockResolvedValue({
          version: 'policy.candidate_adjudication.v1',
          candidates: [],
          currentLibraryCandidateRetrievalTelemetry: { status_id: 'available' },
          currentLibraryCandidateSemanticRetrievalStatusId: 'available',
          currentLibraryCandidateSemanticOutcomeCalibrationStatusId: 'outcome_calibrated',
        }),
      },
      finalizePolicyCandidateAdjudication,
      buildPolicyCandidateContrastiveRetrievalContract: jest.fn().mockReturnValue({ valid: false }),
      policyCandidateContrastiveRetriever: { retrieve: jest.fn().mockResolvedValue(null) },
      buildPolicyCandidateContrastiveEvidence: jest.fn().mockReturnValue(null),
      classificationProgressStageService: { updateStage: jest.fn() },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    const outcome = await service.execute({
      metadata: { title: 'Deep Water', media_type: 'movie' },
      libraries,
    });

    expect(aiClassify).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      libraries,
      expect.any(Object),
      expect.objectContaining({ mode: 'verify' }),
    );
    expect(aiClassify).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      [libraries[1], libraries[0]],
      expect.any(Object),
      expect.objectContaining({ mode: 'adjudicate' }),
    );
    expect(service.policyCandidateAdjudicationEvidenceService.build).toHaveBeenCalledTimes(1);
    expect(finalizePolicyCandidateAdjudication).toHaveBeenCalledWith(expect.objectContaining({
      contract: expect.objectContaining({ candidates: selectedCandidates }),
      aiMatch: expect.objectContaining({ library: libraries[0], format: 'confident' }),
    }));
    expect(outcome.result).toMatchObject({
      normalized: true,
      library: libraries[0],
      needs_clarification: true,
      candidate_bound_verification: { status_id: 'abstained' },
    });
  });
});
