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
        build: jest.fn().mockResolvedValue({ version: 'policy.candidate_adjudication.v1', candidates: [] }),
      },
      finalizePolicyCandidateAdjudication: jest.fn().mockReturnValue({
        library: libraries[1],
        confidence: 71,
        needs_clarification: true,
        method: 'policy_candidate_adjudication',
        candidate_adjudication: { statusId: 'proposed', candidateCount: 2 },
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
    expect(ensureDecisionQuestion).toHaveBeenCalledWith(expect.objectContaining({
      policyResult,
      libraries,
      result: expect.objectContaining({ needs_clarification: true }),
    }));
    expect(ragLoop).not.toHaveBeenCalled();
    expect(outcome.result).toMatchObject({ normalized: true, needs_clarification: true });
  });
});
