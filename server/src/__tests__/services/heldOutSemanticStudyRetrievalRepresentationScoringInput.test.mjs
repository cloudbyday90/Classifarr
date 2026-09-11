/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyRetrievalRepresentationScoringInput,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS,
  validateHeldOutSemanticStudyRetrievalRepresentationScoringInput,
  validateHeldOutSemanticStudyRetrievalRepresentationScoringInputBinding,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationScoringInput.mjs';
import {
  createRetrievalRepresentationEvaluationBundle,
  createRetrievalRepresentationScoringInput,
} from '../helpers/heldOutSemanticStudyRetrievalRepresentationFixtures.mjs';

describe('held-out retrieval-representation scoring input', () => {
  test('accepts a private input that is exactly pinned to the redacted study', () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const scoringInput = createRetrievalRepresentationScoringInput(evaluationBundle);

    expect(validateHeldOutSemanticStudyRetrievalRepresentationScoringInput(scoringInput)).toEqual(
      expect.objectContaining({ ok: true }),
    );
    expect(validateHeldOutSemanticStudyRetrievalRepresentationScoringInputBinding({
      fixtureDocument: evaluationBundle.fixtureDocument,
      scoringInput,
      snapshotDocument: evaluationBundle.snapshotDocument,
    })).toEqual(expect.objectContaining({ ok: true }));
  });

  test('rejects extra fields and a scoring input from another fixed cohort', () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const scoringInput = createRetrievalRepresentationScoringInput(evaluationBundle);
    scoringInput.cases[0].candidates[0].libraryName = 'must-not-cross-boundary';
    scoringInput.snapshotDocumentFingerprint = `sha256:${'0'.repeat(64)}`;

    const validation = validateHeldOutSemanticStudyRetrievalRepresentationScoringInputBinding({
      fixtureDocument: evaluationBundle.fixtureDocument,
      scoringInput,
      snapshotDocument: evaluationBundle.snapshotDocument,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.UNKNOWN_FIELD,
      }),
    ]));
  });

  test('derives only declared-purpose values, not policy provenance or library names', () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const privateReviewCases = evaluationBundle.fixtureDocument.map((fixture, index) => ({
      contract: { candidates: [{ libraryId: 1 }, { libraryId: 2 }], valid: true },
      fixtureId: fixture.id,
      metadata: {
        media_type: index % 2 === 0 ? 'movie' : 'tv',
        overview: `Private synopsis ${index}`,
        title: `Private title ${index}`,
        tmdb_id: index + 1,
      },
    }));
    const scoringInput = buildHeldOutSemanticStudyRetrievalRepresentationScoringInput({
      bundle: {
        fixtureDocument: evaluationBundle.fixtureDocument,
        snapshotDocument: evaluationBundle.snapshotDocument,
      },
      policies: [
        {
          library_id: 1,
          library_name: 'Private documentary library',
          policy_intent_contract: {
            purpose: [{ source: 'operator_only_provenance', values: { include: ['documentary'] } }],
          },
        },
        {
          library_id: 2,
          library_name: 'Private feature library',
          policy_intent_contract: { purpose: [{ values: { include: ['feature'] } }] },
        },
      ],
      privateReviewCases,
    });

    expect(scoringInput).not.toBeNull();
    expect(scoringInput.cases[0].candidates).toEqual([
      expect.objectContaining({ candidateId: 'candidate_a', declaredPurposeTerms: ['documentary'], libraryId: 1 }),
      expect.objectContaining({ candidateId: 'candidate_b', declaredPurposeTerms: ['feature'], libraryId: 2 }),
    ]);
    expect(JSON.stringify(scoringInput)).not.toContain('operator_only_provenance');
    expect(JSON.stringify(scoringInput)).not.toContain('Private documentary library');
  });
});
