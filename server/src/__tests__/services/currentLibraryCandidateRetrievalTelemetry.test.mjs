/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCurrentLibraryCandidateRetrievalTelemetry,
  buildCurrentLibraryCandidateRetrievalTelemetryProjection,
  resolveCurrentLibraryCandidateRetrievalLatencyBand,
} from '../../services/currentLibraryCandidateRetrievalTelemetry.mjs';

const request = {
  candidates: [
    { libraryId: 1, mediaType: 'movie' },
    { libraryId: 2, mediaType: 'movie' },
  ],
};

describe('currentLibraryCandidateRetrievalTelemetry', () => {
  test('maps elapsed durations into a fixed low-cardinality vocabulary', () => {
    expect(resolveCurrentLibraryCandidateRetrievalLatencyBand(0)).toBe('under_25ms');
    expect(resolveCurrentLibraryCandidateRetrievalLatencyBand(24)).toBe('under_25ms');
    expect(resolveCurrentLibraryCandidateRetrievalLatencyBand(25)).toBe('25_to_99ms');
    expect(resolveCurrentLibraryCandidateRetrievalLatencyBand(250)).toBe('250_to_999ms');
    expect(resolveCurrentLibraryCandidateRetrievalLatencyBand(1000)).toBe('1000ms_or_more');
    expect(resolveCurrentLibraryCandidateRetrievalLatencyBand(-1)).toBeNull();
  });

  test('projects only fixed status, band, and bounded counts', () => {
    const telemetry = buildCurrentLibraryCandidateRetrievalTelemetry({
      request,
      elapsedMs: 67,
      retrieval: {
        statusId: 'available',
        candidates: [
          { libraryId: 1, matchCount: 3, directMatch: true, items: [{ title: 'Private Title' }] },
          { libraryId: 2, matchCount: 1, directMatch: false, items: [{ title: 'Other Private Title' }] },
        ],
      },
    });

    expect(telemetry).toEqual({
      version: 'current_library.candidate_retrieval_telemetry.v1',
      statusId: 'available',
      latencyBand: '25_to_99ms',
      candidateCount: 2,
      matchingCandidateCount: 2,
      directMatchCandidateCount: 1,
    });
    expect(JSON.stringify(telemetry)).not.toContain('Private Title');

    expect(buildCurrentLibraryCandidateRetrievalTelemetryProjection({
      ...telemetry,
      title: 'Do not persist',
      provider: 'Do not persist',
      exactElapsedMs: 67,
    })).toEqual({
      version: 'current_library.candidate_retrieval_telemetry.v1',
      status_id: 'available',
      latency_band: '25_to_99ms',
      candidate_count: 2,
      matched_candidate_count: 2,
      direct_match_candidate_count: 1,
    });
  });

  test('drops invalid or incoherent telemetry at the persistence boundary', () => {
    expect(buildCurrentLibraryCandidateRetrievalTelemetryProjection({
      version: 'current_library.candidate_retrieval_telemetry.v1',
      statusId: 'available',
      latencyBand: 'freeform-title',
      candidateCount: 2,
      matchingCandidateCount: 2,
      directMatchCandidateCount: 1,
    })).toBeNull();

    expect(buildCurrentLibraryCandidateRetrievalTelemetryProjection({
      version: 'current_library.candidate_retrieval_telemetry.v1',
      statusId: 'available',
      latencyBand: 'under_25ms',
      candidateCount: 2,
      matchingCandidateCount: 1,
      directMatchCandidateCount: 2,
    })).toBeNull();
  });
});
