/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from './policyCandidateEvidenceOfflineEvaluationContract.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
  validatePolicyCandidateSemanticReferenceSetDocument,
} from './policyCandidateSemanticReferenceSetContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';

export const POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_VERSION =
  'policy.candidate_semantic_reference_set_artifact.v1';

export const POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS = Object.freeze({
  INDEPENDENTLY_LABELLED: 'independently_labelled',
  INVALID: 'invalid',
  NOT_INDEPENDENTLY_LABELLED: 'not_independently_labelled',
  UNAVAILABLE: 'unavailable',
});

function buildAuthority() {
  return Object.freeze({
    automaticActions: Object.freeze({
      aiInvocation: false,
      learning: false,
      policyChange: false,
      retry: false,
      routing: false,
    }),
    scope: 'offline_reference_set_only',
  });
}

function projectValidation(validation, available = true) {
  return Object.freeze({
    available,
    issueCount: Array.isArray(validation?.issues) ? validation.issues.length : 0,
    ok: validation?.ok === true,
  });
}

function buildBindingValidation({ fixtureDocument, fixtureDocumentFingerprint, referenceSetDocument }) {
  if (!Array.isArray(fixtureDocument) || !Array.isArray(referenceSetDocument?.labels)) {
    return Object.freeze({ issueCount: 1, ok: false });
  }

  const fixtureById = new Map(fixtureDocument.map((fixture) => [fixture.id, fixture]));
  const labelsByFixtureId = new Map(referenceSetDocument.labels.map((label) => [label.fixtureId, label]));
  const labelsMatchFixtures = referenceSetDocument.labels.length === fixtureDocument.length &&
    fixtureDocument.every((fixture) => {
      const label = labelsByFixtureId.get(fixture.id);
      return label?.referenceDecisionId === fixture.reference.decisionId;
    });
  const fingerprintMatches = referenceSetDocument.fixtureDocumentFingerprint === fixtureDocumentFingerprint;
  const fixtureIdsAreKnown = referenceSetDocument.labels.every((label) => fixtureById.has(label.fixtureId));

  return Object.freeze({
    issueCount: Number(!fingerprintMatches) + Number(!fixtureIdsAreKnown) + Number(!labelsMatchFixtures),
    ok: fingerprintMatches && fixtureIdsAreKnown && labelsMatchFixtures,
  });
}

function buildDecisionCounts(labels) {
  const counts = Object.fromEntries(Object.values(
    POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_DECISION_IDS,
  ).map((decisionId) => [decisionId, 0]));
  for (const label of labels) counts[label.referenceDecisionId] += 1;
  return Object.freeze(counts);
}

function buildConsensusCounts(labels) {
  return Object.freeze({
    adjudicated: labels.filter((label) => label.consensusStatusId === 'adjudicated').length,
    unanimous: labels.filter((label) => label.consensusStatusId === 'unanimous').length,
  });
}

/**
 * Creates a content-free, reproducible artifact for a separately collected
 * reference set. It never returns fixture names, IDs, labels, reviewer data,
 * descriptions, vectors, prompts, model data, or raw library context.
 */
export function buildPolicyCandidateSemanticReferenceSetArtifact({
  fixtureDocument,
  referenceSetDocument,
} = {}) {
  const fixtureValidation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument(fixtureDocument);
  const fixtureDocumentFingerprint = fixtureValidation.ok
    ? createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument)
    : null;

  if (referenceSetDocument === undefined || referenceSetDocument === null) {
    return Object.freeze({
      authority: buildAuthority(),
      provenance: Object.freeze({ fixtureDocumentFingerprint, referenceSetDocumentFingerprint: null }),
      status: Object.freeze({
        id: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.UNAVAILABLE,
        independentLabelsAvailable: false,
      }),
      summary: null,
      validation: Object.freeze({
        binding: Object.freeze({ available: false, issueCount: 0, ok: false }),
        fixture: projectValidation(fixtureValidation),
        referenceSet: Object.freeze({ available: false, issueCount: 0, ok: false }),
      }),
      version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_VERSION,
    });
  }

  const referenceSetValidation = validatePolicyCandidateSemanticReferenceSetDocument(referenceSetDocument);
  const bindingValidation = fixtureValidation.ok && referenceSetValidation.ok
    ? buildBindingValidation({ fixtureDocument, fixtureDocumentFingerprint, referenceSetDocument })
    : Object.freeze({ issueCount: 0, ok: false });
  const valid = fixtureValidation.ok && referenceSetValidation.ok && bindingValidation.ok;
  const independentlyLabelled = valid && referenceSetDocument.labelingProtocolId ===
    POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS.INDEPENDENT_DOUBLE_BLIND_HUMAN;
  const labels = referenceSetValidation.ok ? referenceSetDocument.labels : [];

  return Object.freeze({
    authority: buildAuthority(),
    provenance: Object.freeze({
      fixtureDocumentFingerprint,
      referenceSetDocumentFingerprint: referenceSetValidation.ok
        ? createPolicyCandidateSemanticSnapshotFingerprint(referenceSetDocument)
        : null,
    }),
    status: Object.freeze({
      id: !valid
        ? POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INVALID
        : independentlyLabelled
          ? POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INDEPENDENTLY_LABELLED
          : POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.NOT_INDEPENDENTLY_LABELLED,
      independentLabelsAvailable: independentlyLabelled,
    }),
    summary: valid ? Object.freeze({
      consensusCounts: buildConsensusCounts(labels),
      decisionCounts: buildDecisionCounts(labels),
      labelledFixtureCount: labels.length,
    }) : null,
    validation: Object.freeze({
      binding: Object.freeze({ available: true, ...bindingValidation }),
      fixture: projectValidation(fixtureValidation),
      referenceSet: projectValidation(referenceSetValidation),
    }),
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_VERSION,
  });
}
