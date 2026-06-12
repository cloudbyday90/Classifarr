import {
  POLICY_CONSTRAINT_MODES,
  POLICY_CONSTRAINT_OUTCOMES,
  evaluatePolicyConstraints,
  evaluateSignalConstraint,
  hasPolicyConstraintFailure,
  normalizePolicyConstraintMode,
} from '../../services/policyConstraintSemantics.mjs';

describe('policyConstraintSemantics', () => {
  test('defaults constraints to advisory unless strict semantics are explicit', () => {
    expect(normalizePolicyConstraintMode({ require_any: ['Comedy'] }))
      .toBe(POLICY_CONSTRAINT_MODES.ADVISORY);
    expect(normalizePolicyConstraintMode({ strict: true, require_any: ['Comedy'] }))
      .toBe(POLICY_CONSTRAINT_MODES.STRICT);
    expect(normalizePolicyConstraintMode({ constraint_mode: 'hard', require_any: ['Comedy'] }))
      .toBe(POLICY_CONSTRAINT_MODES.STRICT);
    expect(normalizePolicyConstraintMode({ runtime: 'score', require_any: ['Comedy'] }))
      .toBe(POLICY_CONSTRAINT_MODES.ADVISORY);
  });

  test('fails strict genre requirements when metadata conflicts', () => {
    const result = evaluateSignalConstraint(
      'genres',
      { strict: true, require_any: ['Animation'] },
      { genres: ['Drama', 'Romance'] },
    );

    expect(result).toEqual(expect.objectContaining({
      mode: POLICY_CONSTRAINT_MODES.STRICT,
      outcome: POLICY_CONSTRAINT_OUTCOMES.FAIL,
      reason_code: 'genres_require_any_mismatch',
    }));
  });

  test('fails strict keyword exclusions against overview text', () => {
    const result = evaluateSignalConstraint(
      'keywords',
      { constraint: 'strict', exclude: ['nudity'] },
      { keywords: [], overview: 'Contains graphic nudity and mature themes.' },
    );

    expect(result).toEqual(expect.objectContaining({
      outcome: POLICY_CONSTRAINT_OUTCOMES.FAIL,
      reason_code: 'keywords_excluded',
    }));
  });

  test('fails strict certification max constraints when rating exceeds policy boundary', () => {
    const result = evaluateSignalConstraint(
      'certifications',
      { runtime_mode: 'strict', mode: 'max', max: 'PG-13' },
      { media_type: 'movie', certification: 'R' },
    );

    expect(result).toEqual(expect.objectContaining({
      outcome: POLICY_CONSTRAINT_OUTCOMES.FAIL,
      reason_code: 'certification_above_max',
    }));
  });

  test('treats missing strict metadata as unknown rather than a hard failure', () => {
    const result = evaluateSignalConstraint(
      'language',
      { strict: true, require_any: ['ja'] },
      {},
    );

    expect(result.outcome).toBe(POLICY_CONSTRAINT_OUTCOMES.UNKNOWN);
    expect(result.reason_code).toBe('language_missing');
  });

  test('aggregates policy-level strict constraint failures across presets', () => {
    const report = evaluatePolicyConstraints({
      id: 77,
      library_id: 14,
      presets: [{
        signals: {
          genres: { require_any: ['Family'], strict: true },
          certifications: { mode: 'max', max: 'PG-13', strict: true },
        },
      }],
    }, {
      genres: ['Romance', 'Comedy'],
      certification: 'R',
      media_type: 'movie',
    });

    expect(report).toEqual(expect.objectContaining({
      policy_id: 77,
      library_id: 14,
      failed: true,
      conflict_count: 2,
    }));
    expect(report.conflicts.map(conflict => conflict.reason_code)).toEqual([
      'genres_require_any_mismatch',
      'certification_above_max',
    ]);
    expect(hasPolicyConstraintFailure(report)).toBe(true);
  });
});
