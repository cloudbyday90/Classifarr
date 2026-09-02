/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import { ClassificationPolicyPathService } from '../../services/classificationPolicyPathService.mjs';

const libraries = [
  { id: 1, name: 'Movies', media_type: 'movie' },
  { id: 2, name: 'Family', media_type: 'movie' },
  { id: 3, name: 'Unrelated', media_type: 'movie' },
];

describe('ClassificationPolicyPathService candidate adjudication', () => {
  test('sends only bounded candidates to AI and preserves operator routing authority', async () => {
    const selectedCandidates = [
      { library: libraries[0], libraryId: 1, libraryNumber: 1, policyScore: 71 },
      { library: libraries[1], libraryId: 2, libraryNumber: 2, policyScore: 69 },
    ];
    const policyResult = {
      action: 'prompt_select',
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
});
