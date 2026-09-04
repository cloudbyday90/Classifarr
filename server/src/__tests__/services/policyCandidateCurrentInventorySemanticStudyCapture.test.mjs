/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  createPolicyCandidateCurrentInventorySemanticStudyCapture,
} from '../../services/policyCandidateCurrentInventorySemanticStudyCapture.mjs';
import {
  validatePolicyCandidateCurrentInventorySemanticStudyCaptureRequest,
} from '../../services/policyCandidateCurrentInventorySemanticStudyCaptureContract.mjs';

const contract = Object.freeze({
  candidates: Object.freeze([
    Object.freeze({ libraryId: 10, mediaType: 'movie' }),
    Object.freeze({ libraryId: 20, mediaType: 'movie' }),
    Object.freeze({ libraryId: 30, mediaType: 'movie' }),
  ]),
  valid: true,
});

function opaqueId(prefix, index) {
  return `${prefix}_${index.toString(16).padStart(16, '0')}`;
}

function caseAt(index, overrides = {}) {
  return {
    contract,
    fixtureId: opaqueId('fixture', index),
    metadata: {
      overview: `Restricted synopsis ${index}`,
      title: `Private media title ${index}`,
    },
    snapshotId: opaqueId('snapshot', index),
    ...overrides,
  };
}

function requestWithCases(count = 24, overrides = {}) {
  return {
    cases: Array.from({ length: count }, (_value, index) => caseAt(index + 1)),
    snapshotSetId: opaqueId('snapshot_set', 1),
    ...overrides,
  };
}

function availableRetrieval() {
  return {
    candidates: [
      { libraryId: 10, topRelevance: 94, items: [{ title: 'Do not retain this candidate item' }] },
      { libraryId: 20, topRelevance: 41, items: [{ title: 'Do not retain this alternative item' }] },
      { libraryId: 30, topRelevance: 57, items: [{ title: 'Do not retain this alternative item' }] },
    ],
    statusId: 'available',
    version: 'current_library.candidate_semantic_retrieval.v2',
  };
}

describe('policyCandidateCurrentInventorySemanticStudyCapture', () => {
  test('captures a sequential 24-case real-inventory cohort as a redacted document', async () => {
    let activeRequests = 0;
    let maximumConcurrentRequests = 0;
    const observedMetadata = [];
    const capture = createPolicyCandidateCurrentInventorySemanticStudyCapture({
      retriever: {
        async retrieve({ metadata }) {
          activeRequests += 1;
          maximumConcurrentRequests = Math.max(maximumConcurrentRequests, activeRequests);
          observedMetadata.push(metadata);
          await Promise.resolve();
          activeRequests -= 1;
          return availableRetrieval();
        },
      },
    });

    const result = await capture.capture(requestWithCases());
    const serialized = JSON.stringify(result);

    expect(result.status).toEqual({ id: 'complete' });
    expect(result.summary).toEqual({ availableCount: 24, caseCount: 24, unavailableCount: 0 });
    expect(result.document.snapshots).toHaveLength(24);
    expect(result.document.snapshots[0]).toEqual({
      alternativeRelevance: 57,
      candidateCount: 3,
      fixtureId: opaqueId('fixture', 1),
      id: opaqueId('snapshot', 1),
      leadingRelevance: 94,
      retrievalStatusId: 'available',
      version: 'policy.candidate_current_inventory_semantic_study_snapshot.v1',
    });
    expect(observedMetadata).toHaveLength(24);
    expect(maximumConcurrentRequests).toBe(1);
    expect(serialized).not.toContain('Private media title');
    expect(serialized).not.toContain('Restricted synopsis');
    expect(serialized).not.toContain('Do not retain this');
    expect(serialized).not.toContain('libraryId');
    expect(serialized).not.toContain('items');
  });

  test('turns an individual retrieval failure into an unavailable study abstention', async () => {
    let calls = 0;
    const capture = createPolicyCandidateCurrentInventorySemanticStudyCapture({
      retriever: {
        async retrieve() {
          calls += 1;
          if (calls === 7) throw new Error('provider response must not leave capture');
          return availableRetrieval();
        },
      },
    });

    const result = await capture.capture(requestWithCases());

    expect(result.status).toEqual({ id: 'complete' });
    expect(result.summary).toEqual({ availableCount: 23, caseCount: 24, unavailableCount: 1 });
    expect(result.document.snapshots[6]).toEqual(expect.objectContaining({
      alternativeRelevance: null,
      leadingRelevance: null,
      retrievalStatusId: 'unavailable',
    }));
  });

  test('rejects an invalid study request before it invokes the retriever', async () => {
    let retrievalCalls = 0;
    const capture = createPolicyCandidateCurrentInventorySemanticStudyCapture({
      retriever: {
        async retrieve() {
          retrievalCalls += 1;
          return availableRetrieval();
        },
      },
    });

    const result = await capture.capture(requestWithCases(23));

    expect(result).toEqual({
      document: null,
      status: { id: 'invalid_request' },
      summary: { caseCount: 23, issueCount: 1 },
      version: 'policy.candidate_current_inventory_semantic_study_capture.v1',
    });
    expect(retrievalCalls).toBe(0);
  });

  test('rejects duplicate opaque identifiers and content-bearing case fields', () => {
    const cases = Array.from({ length: 24 }, (_value, index) => caseAt(index + 1));
    cases[1] = caseAt(2, {
      fixtureId: cases[0].fixtureId,
      title: 'Must not be accepted as a study field',
    });

    const validation = validatePolicyCandidateCurrentInventorySemanticStudyCaptureRequest({
      cases,
      snapshotSetId: opaqueId('snapshot_set', 1),
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'duplicate_fixture_id' }),
      expect.objectContaining({ riskId: 'unknown_field' }),
    ]));
  });

  test('rejects a capture case that the live current-library retriever cannot use', () => {
    const cases = Array.from({ length: 24 }, (_value, index) => caseAt(index + 1));
    cases[0] = caseAt(1, {
      contract: {
        ...contract,
        candidates: contract.candidates.map((candidate) => ({ libraryId: candidate.libraryId })),
      },
    });
    cases[1] = caseAt(2, {
      metadata: { overview: 'Metadata without a title cannot make a retrieval request.' },
    });

    const validation = validatePolicyCandidateCurrentInventorySemanticStudyCaptureRequest({
      cases,
      snapshotSetId: opaqueId('snapshot_set', 1),
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'invalid_candidate_contract' }),
      expect.objectContaining({ riskId: 'invalid_metadata' }),
    ]));
  });
});
