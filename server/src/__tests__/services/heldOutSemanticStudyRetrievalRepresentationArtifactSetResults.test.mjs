/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationArtifactProducer.mjs';
import {
  buildHeldOutSemanticStudyRetrievalRepresentationResults,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationResults.mjs';
import {
  createRetrievalRepresentationEvaluationBundle,
  createRetrievalRepresentationReferenceSet,
  createRetrievalRepresentationSubmission,
} from '../helpers/heldOutSemanticStudyRetrievalRepresentationFixtures.mjs';

test('reports each historical-label condition from one paired, bound artifact set', () => {
  const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
  const produced = buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission({
    evaluationBundle,
    submission: createRetrievalRepresentationSubmission(evaluationBundle),
  });

  const result = buildHeldOutSemanticStudyRetrievalRepresentationResults({
    evaluationBundle,
    referenceSetDocument: createRetrievalRepresentationReferenceSet(evaluationBundle),
    representationArtifact: produced.artifactSet,
  });

  expect(result.status.id).toBe('summary_available');
  expect(result.report.conditions).toEqual(expect.arrayContaining([
    expect.objectContaining({
      conditionId: 'historical_classification_label_included',
      comparisons: expect.arrayContaining([
        expect.objectContaining({ representationId: 'nearest_item_history' }),
      ]),
    }),
    expect.objectContaining({
      conditionId: 'historical_classification_label_excluded',
      comparisons: expect.arrayContaining([
        expect.objectContaining({ representationId: 'media_description' }),
      ]),
    }),
  ]));
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain('Private title');
  expect(serialized).not.toContain('fixture_0000000000000000');
});
