/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { Readable } from 'node:stream';

import { describe, expect, jest, test } from '@jest/globals';

import {
  loadBoundedStdinJsonInput,
} from '../../scripts/boundedStdinJsonInput.mjs';
import {
  runPolicyCandidateCurrentInventorySemanticStudyCapture,
} from '../../scripts/runPolicyCandidateCurrentInventorySemanticStudyCapture.mjs';

function opaqueId(prefix, index) {
  return `${prefix}_${index.toString(16).padStart(16, '0')}`;
}

function request() {
  return {
    cases: Array.from({ length: 24 }, (_value, index) => ({
      contract: {
        candidates: [
          { libraryId: 10, mediaType: 'movie' },
          { libraryId: 20, mediaType: 'movie' },
        ],
        valid: true,
      },
      fixtureId: opaqueId('fixture', index + 1),
      metadata: {
        overview: `Private overview ${index + 1}`,
        title: `Private title ${index + 1}`,
      },
      snapshotId: opaqueId('snapshot', index + 1),
    })),
    snapshotSetId: opaqueId('snapshot_set', 1),
  };
}

function redactedDocument() {
  return {
    retrievalProtocolVersion: 'current_library.candidate_semantic_retrieval.v2',
    snapshotSetId: opaqueId('snapshot_set', 1),
    snapshots: [{
      alternativeRelevance: 52,
      candidateCount: 2,
      fixtureId: opaqueId('fixture', 1),
      id: opaqueId('snapshot', 1),
      leadingRelevance: 64,
      retrievalStatusId: 'available',
      version: 'policy.candidate_current_inventory_semantic_study_snapshot.v1',
    }],
    version: 'policy.candidate_current_inventory_semantic_study_snapshot_document.v1',
  };
}

describe('runPolicyCandidateCurrentInventorySemanticStudyCapture', () => {
  test('passes a bounded private stdin request to capture and returns only its redacted document', async () => {
    const input = request();
    const capture = { capture: jest.fn().mockResolvedValue({
      document: redactedDocument(),
      status: { id: 'complete' },
    }) };

    const document = await runPolicyCandidateCurrentInventorySemanticStudyCapture({
      argv: [],
      capture,
      stdin: Readable.from([JSON.stringify(input)]),
    });

    expect(capture.capture).toHaveBeenCalledWith(input);
    expect(document).toEqual(redactedDocument());
    expect(JSON.stringify(document)).not.toContain('Private title');
    expect(JSON.stringify(document)).not.toContain('Private overview');
    expect(JSON.stringify(document)).not.toContain('libraryId');
  });

  test('rejects oversized and malformed private stdin without exposing its contents', async () => {
    await expect(loadBoundedStdinJsonInput({
      maximumBytes: 8,
      stdin: Readable.from(['private title that must not be repeated']),
    })).rejects.toThrow('Standard input exceeds the allowed size.');

    await expect(runPolicyCandidateCurrentInventorySemanticStudyCapture({
      argv: ['--input-file', 'private-study.json'],
      stdin: Readable.from(['{}']),
    })).rejects.toThrow('This command accepts its study request only on standard input.');
  });

  test('fails closed when capture rejects the request', async () => {
    await expect(runPolicyCandidateCurrentInventorySemanticStudyCapture({
      argv: [],
      capture: { capture: jest.fn().mockResolvedValue({
        document: null,
        status: { id: 'invalid_request' },
      }) },
      stdin: Readable.from([JSON.stringify(request())]),
    })).rejects.toThrow('Current-inventory semantic study capture is invalid.');
  });
});
