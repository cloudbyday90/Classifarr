import {
  CANDIDATE_VIABILITY,
  buildCandidateDiagnostics,
  inferPresetEvidenceMode,
  isWeakCandidateViability,
  hasProfileHardExclusion,
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

  test('treats generic comedy preset signals as compatibility rather than identity', () => {
    const policy = {
      trust_patterns: false,
      trust_rag: false,
      trust_history: false,
      presets: [{
        signals: {
          genres: { require_any: ['Comedy'] },
          keywords: { prefer: ['funny', 'humor', 'comedy'] },
        },
      }],
    };

    expect(inferPresetEvidenceMode(policy, { preset: 74 })).toBe('compatibility');
    expect(buildCandidateDiagnostics(policy, {
      preset: 74,
      profile: 0,
      pattern: 0,
      rag: 0,
      history: 0,
    })).toEqual(expect.objectContaining({
      primary_viability: CANDIDATE_VIABILITY.COMPATIBILITY_ONLY,
      evidence_class: 'compatibility',
      primary_anchor_eligible: false,
      suppression_reasons: expect.arrayContaining(['weak_primary_evidence']),
    }));
  });

  test('keeps specialized stand-up keywords as identity evidence', () => {
    const policy = {
      trust_patterns: false,
      trust_rag: false,
      trust_history: false,
      presets: [{
        signals: {
          genres: { require_any: ['Comedy'] },
          keywords: { require_any: ['stand-up', 'standup', 'comedy special'] },
        },
      }],
    };

    expect(inferPresetEvidenceMode(policy, { preset: 82 })).toBe('identity');
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

  test('treats rag-only evidence as weak viability', () => {
    expect(isWeakCandidateViability({
      primary_viability: CANDIDATE_VIABILITY.RAG_IMPROVED,
    })).toBe(true);
  });

  test('attaches profile scoring detail without changing source booleans', () => {
    const diagnostics = buildCandidateDiagnostics(
      { trust_patterns: false, trust_rag: false, trust_history: false, presets: [] },
      { preset: 0, profile: 42, pattern: 0, rag: 0, history: 0 },
      null,
      {
        profileDiagnostics: {
          schema_version: 1,
          available: true,
          rating: { normalized: 'TV-MA', score_delta: 15 },
        },
      },
    );

    expect(diagnostics.positive_sources.profile).toBe(true);
    expect(diagnostics.profile_scoring).toEqual(expect.objectContaining({
      schema_version: 1,
      rating: expect.objectContaining({ normalized: 'TV-MA' }),
    }));
  });

  test('attaches RAG evidence quality diagnostics without changing source booleans', () => {
    const diagnostics = buildCandidateDiagnostics(
      { trust_patterns: false, trust_rag: true, trust_history: false, presets: [] },
      { preset: 0, profile: 0, pattern: 0, rag: 36, history: 0 },
      null,
      {
        ragDiagnostics: {
          schema_version: 1,
          score: 36,
          reasons: ['untrusted_outcome'],
        },
      },
    );

    expect(diagnostics.positive_sources.rag).toBe(true);
    expect(diagnostics.rag_evidence_quality).toEqual(expect.objectContaining({
      schema_version: 1,
      reasons: ['untrusted_outcome'],
    }));
  });

  test('marks profile hard exclusions as ineligible primary anchors', () => {
    const profileDiagnostics = {
      schema_version: 1,
      available: true,
      exclusions: {
        ratings: [{ value: 'R', score_delta: -50 }],
        genres: [],
        keywords: [],
      },
    };

    const diagnostics = buildCandidateDiagnostics(
      { trust_patterns: false, trust_rag: true, trust_history: false, presets: [] },
      { preset: 0, profile: 0, pattern: 0, rag: 72, history: 0 },
      null,
      { profileDiagnostics },
    );

    expect(hasProfileHardExclusion(profileDiagnostics)).toBe(true);
    expect(diagnostics).toEqual(expect.objectContaining({
      primary_viability: CANDIDATE_VIABILITY.RAG_IMPROVED,
      evidence_class: 'negative_conflict',
      profile_hard_excluded: true,
      primary_anchor_eligible: false,
      suppression_reasons: expect.arrayContaining(['profile_hard_exclusion']),
    }));
    expect(isWeakCandidateViability(diagnostics)).toBe(true);
  });

  test('marks strict policy constraint failures as negative conflicts', () => {
    const constraintDiagnostics = {
      schema_version: 1,
      failed: true,
      conflict_count: 1,
      conflicts: [{
        signal_type: 'certifications',
        reason_code: 'certification_above_max',
        expected: { max: 'PG-13' },
        actual: 'R',
      }],
    };

    const diagnostics = buildCandidateDiagnostics(
      {
        trust_patterns: false,
        trust_rag: false,
        trust_history: false,
        presets: [{ signals: { certifications: { mode: 'max', max: 'PG-13', strict: true } } }],
      },
      { preset: 80, profile: 0, pattern: 0, rag: 0, history: 0 },
      null,
      { constraintDiagnostics },
    );

    expect(diagnostics).toEqual(expect.objectContaining({
      evidence_class: 'negative_conflict',
      primary_anchor_eligible: false,
      suppression_reasons: expect.arrayContaining(['policy_constraint_conflict']),
      policy_constraints: constraintDiagnostics,
    }));
    expect(isWeakCandidateViability(diagnostics)).toBe(true);
  });
});
