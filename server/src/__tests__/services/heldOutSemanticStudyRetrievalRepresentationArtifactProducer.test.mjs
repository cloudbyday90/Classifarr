/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationArtifactProducer.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS,
  validateHeldOutSemanticStudyRetrievalRepresentationArtifactSetBinding,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationArtifactSet.mjs';
import {
  validateHeldOutSemanticStudyRetrievalRepresentationSubmission,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationSubmission.mjs';
import {
  createRetrievalRepresentationEvaluationBundle,
  createRetrievalRepresentationSubmission,
} from '../helpers/heldOutSemanticStudyRetrievalRepresentationFixtures.mjs';

describe('held-out retrieval-representation artifact producer', () => {
  test('produces paired content-free label-ablation artifacts from one complete submission', () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const result = buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission({
      evaluationBundle,
      submission: createRetrievalRepresentationSubmission(evaluationBundle),
    });

    expect(result.status.id).toBe(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS
        .ARTIFACT_SET_READY,
    );
    expect(result.authority.automaticActions).toEqual({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    });
    expect(result.artifactSet.conditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ conditionId: 'historical_classification_label_included' }),
      expect.objectContaining({ conditionId: 'historical_classification_label_excluded' }),
    ]));
    expect(validateHeldOutSemanticStudyRetrievalRepresentationArtifactSetBinding({
      artifactSet: result.artifactSet,
      fixtureDocument: evaluationBundle.fixtureDocument,
      snapshotDocument: evaluationBundle.snapshotDocument,
    })).toEqual(expect.objectContaining({ ok: true }));
    const serialized = JSON.stringify(result.artifactSet);
    expect(serialized).not.toContain('Private title');
  });

  test('rejects a submission that is not pinned to the evaluation snapshot', () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const submission = createRetrievalRepresentationSubmission(evaluationBundle);
    submission.snapshotDocumentFingerprint = `sha256:${'0'.repeat(64)}`;

    const result = buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission({
      evaluationBundle,
      submission,
    });

    expect(result.artifactSet).toBeNull();
    expect(result.status.id).toBe(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_PRODUCER_STATUS_IDS.SUBMISSION_INVALID,
    );
  });

  test('rejects source text or provider details in a categorical submission', () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const submission = createRetrievalRepresentationSubmission(evaluationBundle);
    submission.signals[0].prompt = 'Private source text must not cross the boundary.';

    expect(validateHeldOutSemanticStudyRetrievalRepresentationSubmission(submission)).toEqual(
      expect.objectContaining({ ok: false }),
    );
  });

  test('marks a pair invalid when a shared representation differs across label conditions', () => {
    const evaluationBundle = createRetrievalRepresentationEvaluationBundle();
    const result = buildHeldOutSemanticStudyRetrievalRepresentationArtifactSetFromSubmission({
      evaluationBundle,
      submission: createRetrievalRepresentationSubmission(evaluationBundle),
    });
    const artifactSet = JSON.parse(JSON.stringify(result.artifactSet));
    const included = artifactSet.conditions.find((condition) => (
      condition.conditionId === 'historical_classification_label_included'
    ));
    included.representationArtifact.representationResults[0].signals[0].decisionId = 'abstain';

    const validation = validateHeldOutSemanticStudyRetrievalRepresentationArtifactSetBinding({
      artifactSet,
      fixtureDocument: evaluationBundle.fixtureDocument,
      snapshotDocument: evaluationBundle.snapshotDocument,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_ARTIFACT_SET_RISK_IDS.CONFOUNDED_ABLATION,
      }),
    ]));
  });
});
