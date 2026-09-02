/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateSemanticReferenceSetArtifact,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS,
} from '../../services/policyCandidateSemanticReferenceSetArtifact.mjs';
import {
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS,
  validatePolicyCandidateSemanticReferenceSetDocument,
} from '../../services/policyCandidateSemanticReferenceSetContract.mjs';
import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from '../../services/policyCandidateSemanticSnapshotFingerprint.mjs';

const FIXTURE_DOCUMENT_URL = new URL(
  '../../../../scripts/fixtures/policy-candidate-evidence-offline-evaluation.fixtures.json',
  import.meta.url,
);

function buildReferenceSetDocument(fixtureDocument, {
  labelingProtocolId = POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS
    .INDEPENDENT_DOUBLE_BLIND_HUMAN,
} = {}) {
  return {
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument),
    labelingProtocolId,
    labels: fixtureDocument.map((fixture) => ({
      consensusStatusId: 'unanimous',
      fixtureId: fixture.id,
      referenceDecisionId: fixture.reference.decisionId,
      reviewerCount: 2,
    })),
    referenceSetId: 'semantic-reference-set',
    version: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_DOCUMENT_VERSION,
  };
}

async function loadFixtureDocument() {
  return JSON.parse(await readFile(FIXTURE_DOCUMENT_URL, 'utf8'));
}

describe('policyCandidateSemanticReferenceSetArtifact', () => {
  test('creates a content-free artifact for a bound independently-labelled reference set', async () => {
    const fixtureDocument = await loadFixtureDocument();
    const referenceSetDocument = buildReferenceSetDocument(fixtureDocument);

    const artifact = buildPolicyCandidateSemanticReferenceSetArtifact({
      fixtureDocument,
      referenceSetDocument,
    });

    expect(artifact.status).toEqual({
      id: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INDEPENDENTLY_LABELLED,
      independentLabelsAvailable: true,
    });
    expect(artifact.summary).toEqual({
      consensusCounts: { adjudicated: 0, unanimous: 8 },
      decisionCounts: { abstain: 2, admit: 2, review: 4 },
      labelledFixtureCount: 8,
    });
    expect(artifact.validation).toEqual({
      binding: { available: true, issueCount: 0, ok: true },
      fixture: { available: true, issueCount: 0, ok: true },
      referenceSet: { available: true, issueCount: 0, ok: true },
    });
    const serialized = JSON.stringify(artifact);
    expect(serialized).not.toContain('Katrina-like documentary ambiguity');
    expect(serialized).not.toContain('katrina-like-documentary-ambiguity');
  });

  test('keeps a synthetic example measurable without passing it off as independent review', async () => {
    const fixtureDocument = await loadFixtureDocument();
    const artifact = buildPolicyCandidateSemanticReferenceSetArtifact({
      fixtureDocument,
      referenceSetDocument: buildReferenceSetDocument(fixtureDocument, {
        labelingProtocolId: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_LABELING_PROTOCOL_IDS.SYNTHETIC_EXAMPLE,
      }),
    });

    expect(artifact.status).toEqual({
      id: POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.NOT_INDEPENDENTLY_LABELLED,
      independentLabelsAvailable: false,
    });
  });

  test('rejects extra raw-content fields and does not echo them in the artifact', async () => {
    const fixtureDocument = await loadFixtureDocument();
    const referenceSetDocument = buildReferenceSetDocument(fixtureDocument);
    referenceSetDocument.labels[0].description = 'Sensitive reference text';

    expect(validatePolicyCandidateSemanticReferenceSetDocument(referenceSetDocument).ok).toBe(false);

    const artifact = buildPolicyCandidateSemanticReferenceSetArtifact({
      fixtureDocument,
      referenceSetDocument,
    });

    expect(artifact.status.id).toBe(POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INVALID);
    expect(JSON.stringify(artifact)).not.toContain('Sensitive reference text');
  });

  test('rejects a reference set bound to a different fixture document', async () => {
    const fixtureDocument = await loadFixtureDocument();
    const referenceSetDocument = buildReferenceSetDocument(fixtureDocument);
    referenceSetDocument.fixtureDocumentFingerprint = `sha256:${'0'.repeat(64)}`;

    const artifact = buildPolicyCandidateSemanticReferenceSetArtifact({
      fixtureDocument,
      referenceSetDocument,
    });

    expect(artifact.status.id).toBe(POLICY_CANDIDATE_SEMANTIC_REFERENCE_SET_ARTIFACT_STATUS_IDS.INVALID);
    expect(artifact.validation.binding).toEqual({ available: true, issueCount: 1, ok: false });
  });
});
