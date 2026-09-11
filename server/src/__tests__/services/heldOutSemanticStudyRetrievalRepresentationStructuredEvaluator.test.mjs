/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyRetrievalRepresentationEvaluatorPrompt,
  createHeldOutSemanticStudyRetrievalRepresentationStructuredEvaluator,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_STRUCTURED_EVALUATOR_STATUS_IDS as STATUS_IDS,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationStructuredEvaluator.mjs';

const decisions = Object.freeze({
  declaredLibraryPurposeDecisionId: 'admit',
  mediaDescriptionDecisionId: 'review',
  nearestItemHistoryClassificationLabelExcludedDecisionId: 'abstain',
  nearestItemHistoryClassificationLabelIncludedDecisionId: 'admit',
});

const request = Object.freeze({
  declaredLibraryPurpose: [{ candidateId: 'candidate_a', declaredPurposeTerms: ['documentary'] }],
  mediaDescription: 'Title: Example',
  nearestItemHistoryClassificationLabelExcluded: [],
  nearestItemHistoryClassificationLabelIncluded: [],
});

function admittedProvider() {
  return {
    authority: {
      capabilities: { providerEnforcedStructuredOutput: true },
      effectiveMode: 'structured_contract',
    },
    isCloud: false,
    type: 'ollama',
  };
}

describe('held-out retrieval-representation structured evaluator', () => {
  test('uses only an admitted self-hosted structured provider and retains categorical output', async () => {
    const aiRouter = {
      classify: jest.fn(async () => JSON.stringify(decisions)),
      getProvider: jest.fn(async () => admittedProvider()),
    };
    const evaluator = createHeldOutSemanticStudyRetrievalRepresentationStructuredEvaluator({ aiRouter });

    const result = await evaluator.evaluate(request);

    expect(result).toEqual({ decisions, statusId: STATUS_IDS.ADMITTED });
    expect(aiRouter.classify).toHaveBeenCalledWith(expect.stringContaining('UNTRUSTED_EVIDENCE_JSON'),
      expect.objectContaining({
        authorityMode: 'structured_contract',
        requireAuthorityMode: true,
        requestType: 'held_out_retrieval_representation_study',
      }));
  });

  test('does not send private study material to a cloud, fallback, or unverified provider', async () => {
    const aiRouter = {
      classify: jest.fn(),
      getProvider: jest.fn(async () => ({ ...admittedProvider(), isCloud: true })),
    };
    const evaluator = createHeldOutSemanticStudyRetrievalRepresentationStructuredEvaluator({ aiRouter });

    await expect(evaluator.evaluate(request)).resolves.toEqual({
      decisions: null,
      statusId: STATUS_IDS.PROVIDER_UNAVAILABLE,
    });
    expect(aiRouter.classify).not.toHaveBeenCalled();
  });

  test('rejects malformed output and bounded prompts without retaining an explanation', async () => {
    const aiRouter = {
      classify: jest.fn(async () => ({ ...decisions, explanation: 'private reasoning' })),
      getProvider: jest.fn(async () => admittedProvider()),
    };
    const evaluator = createHeldOutSemanticStudyRetrievalRepresentationStructuredEvaluator({ aiRouter });

    await expect(evaluator.evaluate(request)).resolves.toEqual({
      decisions: null,
      statusId: STATUS_IDS.OUTPUT_INVALID,
    });
    expect(buildHeldOutSemanticStudyRetrievalRepresentationEvaluatorPrompt({
      content: 'x'.repeat(50 * 1024),
    })).toBeNull();
  });
});
