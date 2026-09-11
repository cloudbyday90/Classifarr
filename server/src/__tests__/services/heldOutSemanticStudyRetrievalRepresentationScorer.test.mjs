/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createHeldOutSemanticStudyRetrievalRepresentationScorer,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORER_STATUS_IDS as STATUS_IDS,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationScorer.mjs';
import {
  createRetrievalRepresentationEvaluationBundle,
  createRetrievalRepresentationScoringInput,
} from '../helpers/heldOutSemanticStudyRetrievalRepresentationFixtures.mjs';

const decisions = Object.freeze({
  declaredLibraryPurposeDecisionId: 'admit',
  mediaDescriptionDecisionId: 'admit',
  nearestItemHistoryClassificationLabelExcludedDecisionId: 'review',
  nearestItemHistoryClassificationLabelIncludedDecisionId: 'review',
});

function availableEvidence(candidates) {
  return {
    candidates: candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      items: [{
        classificationLabel: candidate.candidateId === 'candidate_a' ? 'Documentaries' : 'Features',
        metadata: {
          media_type: 'movie',
          overview: 'Private historical synopsis',
          title: 'Private historical title',
          year: 2024,
        },
      }],
    })),
    statusId: 'available',
  };
}

describe('held-out retrieval-representation scorer', () => {
  test('creates only a complete categorical submission from paired label representations', async () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const scoringInput = createRetrievalRepresentationScoringInput(evaluationBundle);
    const evaluator = { evaluate: jest.fn(async () => ({ decisions, statusId: 'admitted' })) };
    const historySource = {
      retrieve: jest.fn(async ({ candidates }) => availableEvidence(candidates)),
    };
    const scorer = createHeldOutSemanticStudyRetrievalRepresentationScorer({ evaluator, historySource });

    const result = await scorer.score({ evaluationBundle, scoringInput });

    expect(result.status.id).toBe(STATUS_IDS.SUBMISSION_READY);
    expect(result.authority.automaticActions).toEqual({
      aiInvocation: true,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    });
    expect(result.submission.signals).toHaveLength(24);
    expect(evaluator.evaluate).toHaveBeenCalledTimes(24);
    const firstRequest = evaluator.evaluate.mock.calls[0][0];
    expect(firstRequest.nearestItemHistoryClassificationLabelIncluded[0].items[0])
      .toContain('Classified: Documentaries');
    expect(firstRequest.nearestItemHistoryClassificationLabelExcluded[0].items[0])
      .not.toContain('Classified: Documentaries');
    expect(JSON.stringify(result)).not.toContain('Private historical synopsis');
    expect(JSON.stringify(result)).not.toContain('Documentaries');
  });

  test('fails closed when history is unavailable before an evaluator request', async () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const evaluator = { evaluate: jest.fn() };
    const scorer = createHeldOutSemanticStudyRetrievalRepresentationScorer({
      evaluator,
      historySource: { retrieve: async () => ({ statusId: 'unavailable' }) },
    });

    const result = await scorer.score({
      evaluationBundle,
      scoringInput: createRetrievalRepresentationScoringInput(evaluationBundle),
    });

    expect(result.status.id).toBe(STATUS_IDS.HISTORY_UNAVAILABLE);
    expect(evaluator.evaluate).not.toHaveBeenCalled();
  });

  test('rejects a malformed evaluator response without exposing source material', async () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const scorer = createHeldOutSemanticStudyRetrievalRepresentationScorer({
      evaluator: { evaluate: async () => ({ decisions: null, statusId: 'output_invalid' }) },
      historySource: { retrieve: async ({ candidates }) => availableEvidence(candidates) },
    });

    const result = await scorer.score({
      evaluationBundle,
      scoringInput: createRetrievalRepresentationScoringInput(evaluationBundle),
    });

    expect(result.status.id).toBe(STATUS_IDS.EVALUATOR_OUTPUT_INVALID);
    expect(result.submission).toBeNull();
    expect(JSON.stringify(result)).not.toContain('Private historical title');
  });

  test('fails closed if the admitted evaluator throws after receiving a request', async () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const scorer = createHeldOutSemanticStudyRetrievalRepresentationScorer({
      evaluator: { evaluate: async () => { throw new Error('private provider failure'); } },
      historySource: { retrieve: async ({ candidates }) => availableEvidence(candidates) },
    });

    const result = await scorer.score({
      evaluationBundle,
      scoringInput: createRetrievalRepresentationScoringInput(evaluationBundle),
    });

    expect(result.status.id).toBe(STATUS_IDS.EVALUATOR_UNAVAILABLE);
    expect(result.authority.automaticActions.aiInvocation).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private provider failure');
  });
});
