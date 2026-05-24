import {
  CANDIDATE_VIABILITY,
  buildCandidateDiagnostics,
  inferPresetEvidenceMode,
} from '../../services/policyCandidateDiagnostics.mjs';

describe('policyCandidateDiagnostics', () => {
  test('treats positive preset score with identity signals as identity evidence', () => {
    const policy = {
      trust_patterns: false,
      trust_rag: false,
      trust_history: false,
      presets: [{
        signals: {
          genres: { require_any: ['Animation'] },
          media_type: { include: ['tv'] },
        },
      }],
    };

    expect(inferPresetEvidenceMode(policy, { preset: 62 })).toBe('identity');
    expect(buildCandidateDiagnostics(policy, { preset: 62, profile: 0, pattern: 0, rag: 0, history: 0 }))
      .toEqual(expect.objectContaining({
        primary_viability: CANDIDATE_VIABILITY.IDENTITY_EVIDENCE,
        positive_sources: expect.objectContaining({ preset: 'identity' }),
      }));
  });

  test('classifies compatibility-only preset support when no identity signals exist', () => {
    const policy = {
      trust_patterns: false,
      trust_rag: false,
      trust_history: false,
      presets: [{
        signals: {
          media_type: { include: ['movie'] },
          language: { prefer: ['en'] },
        },
      }],
    };

    const diagnostics = buildCandidateDiagnostics(policy, {
      preset: 55,
      profile: 0,
      pattern: 0,
      rag: 0,
      history: 0,
    });

    expect(diagnostics.primary_viability).toBe(CANDIDATE_VIABILITY.COMPATIBILITY_ONLY);
    expect(diagnostics.positive_sources.preset).toBe('compatibility');
  });

  test('classifies profile-only and rag-improved candidates distinctly', () => {
    const emptyPolicy = {
      trust_patterns: false,
      trust_rag: true,
      trust_history: false,
      presets: [],
    };

    expect(buildCandidateDiagnostics(emptyPolicy, {
      preset: 0,
      profile: 41,
      pattern: 0,
      rag: 0,
      history: 0,
    }).primary_viability).toBe(CANDIDATE_VIABILITY.PROFILE_ONLY);

    expect(buildCandidateDiagnostics(emptyPolicy, {
      preset: 0,
      profile: 0,
      pattern: 0,
      rag: 71,
      history: 0,
    }).primary_viability).toBe(CANDIDATE_VIABILITY.RAG_IMPROVED);
  });
});
