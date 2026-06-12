/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  assessProfileCompatibility,
  assessRagEvidenceMatch,
  scoreRagEvidenceForLibrary,
} from '../../services/ragEvidenceQualityGate.mjs';

describe('ragEvidenceQualityGate', () => {
  test('keeps trusted final outcomes at full quality', () => {
    const result = assessRagEvidenceMatch({
      libraryId: 5,
      libraryName: 'Movies',
      status: 'completed',
      similarity: 0.82,
    }, {
      profileDiagnostics: { schema_version: 1, available: true, final_score: 40 },
    });

    expect(result.quality_multiplier).toBe(1);
    expect(result.quality_score).toBe(82);
    expect(result.reasons).toEqual([]);
  });

  test('demotes unknown outcome provenance', () => {
    const result = assessRagEvidenceMatch({
      libraryId: 5,
      libraryName: 'Movies',
      similarity: 0.8,
    });

    expect(result.quality_score).toBe(56);
    expect(result.reasons).toEqual(['unknown_outcome']);
  });

  test('demotes evaluated but incompatible profile evidence', () => {
    const result = assessRagEvidenceMatch({
      libraryId: 5,
      libraryName: 'Movies',
      status: 'completed',
      similarity: 0.8,
    }, {
      profileDiagnostics: { schema_version: 1, available: true, final_score: 0 },
    });

    expect(result.quality_score).toBe(40);
    expect(result.reasons).toEqual(['profile_incompatible']);
    expect(result.profile_compatible).toBe(false);
  });

  test('hard profile exclusions zero RAG support', () => {
    const profile = assessProfileCompatibility({
      schema_version: 1,
      available: true,
      exclusions: {
        ratings: [{ value: 'R' }],
      },
    });

    expect(profile.compatible).toBe(false);
    expect(profile.multiplier).toBe(0);
    expect(profile.reason).toBe('profile_hard_exclusion');
  });

  test('scores the highest quality match for the requested library', () => {
    const result = scoreRagEvidenceForLibrary({
      libraryId: 5,
      profileDiagnostics: { schema_version: 1, available: true, final_score: 35 },
      matches: [
        { libraryId: 5, libraryName: 'Movies', status: 'awaiting_decision', similarity: 0.95 },
        { libraryId: 5, libraryName: 'Movies', status: 'completed', similarity: 0.80 },
        { libraryId: 6, libraryName: 'Family', status: 'completed', similarity: 0.99 },
      ],
    });

    expect(result.score).toBe(80);
    expect(result.diagnostics.considered_count).toBe(2);
    expect(result.diagnostics.top_match.status).toBe('completed');
    expect(result.diagnostics.reasons).toContain('untrusted_outcome');
  });
});
