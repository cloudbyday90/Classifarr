import { buildPolicyConfigurationView } from '../../services/policyConfigurationView.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 14,
    library_name: 'Family',
    library_media_type: 'movie',
    presets: [],
    ...overrides,
  };
}

function preset(overrides = {}) {
  return {
    id: 5,
    key: 'family',
    name: 'Family',
    source: 'builtin',
    weight: 1,
    signals: {},
    custom_signals: null,
    ...overrides,
  };
}

describe('policyConfigurationView', () => {
  test('projects preset signals into explicit policy-intent buckets', () => {
    const result = buildPolicyConfigurationView(policy({
      presets: [preset({
        signals: {
          genres: { require_any: ['Family'] },
          keywords: { require_any: ['workplace'], semantics: 'compatibility' },
          certifications: { mode: 'max', max: 'PG-13', strict: true },
          studios: { prefer: ['Pixar'] },
          language: { exclude: ['ja'] },
        },
      })],
    }));

    expect(result.identity_signals).toEqual([
      expect.objectContaining({
        role: 'identity',
        signal_type: 'genres',
        semantics: 'identity',
        constraint_mode: 'advisory',
      }),
    ]);
    expect(result.compatibility_signals).toEqual([
      expect.objectContaining({
        role: 'compatibility',
        signal_type: 'keywords',
        semantics: 'compatibility',
      }),
    ]);
    expect(result.strict_constraints).toEqual([
      expect.objectContaining({
        role: 'strict_constraint',
        signal_type: 'certifications',
        constraint_mode: 'strict',
        values: { mode: 'max', max: 'PG-13' },
      }),
    ]);
    expect(result.boosters).toEqual([
      expect.objectContaining({
        role: 'booster',
        signal_type: 'studios',
        values: { prefer: ['Pixar'] },
      }),
    ]);
    expect(result.exclusions).toEqual([
      expect.objectContaining({
        role: 'exclusion',
        signal_type: 'language',
        values: { exclude: ['ja'] },
      }),
    ]);
    expect(result.summary.counts).toEqual({
      identity_signals: 1,
      compatibility_signals: 1,
      strict_constraints: 1,
      boosters: 1,
      exclusions: 1,
      warnings: 0,
    });
  });

  test('merges custom signals and marks merged/custom sources', () => {
    const result = buildPolicyConfigurationView(policy({
      presets: [preset({
        signals: {
          genres: { require_any: ['Comedy'] },
        },
        custom_signals: {
          genres: { require_any: ['Romance'], semantics: 'compatibility' },
          certifications: { mode: 'max', max: 'R', constraint_mode: 'hard' },
        },
      })],
    }));

    expect(result.compatibility_signals).toContainEqual(expect.objectContaining({
      signal_type: 'genres',
      source: 'merged',
      semantics: 'compatibility',
      values: { require_any: ['Comedy', 'Romance'] },
    }));
    expect(result.strict_constraints).toContainEqual(expect.objectContaining({
      signal_type: 'certifications',
      source: 'custom',
      constraint_mode: 'strict',
    }));
  });

  test('adds warnings when a policy only has advisory exclusions and no identity signals', () => {
    const result = buildPolicyConfigurationView(policy({
      presets: [preset({
        signals: {
          language: { exclude: ['ja'] },
        },
      })],
    }));

    expect(result.warnings).toEqual([
      expect.objectContaining({ reason_code: 'no_identity_signals' }),
      expect.objectContaining({ reason_code: 'advisory_exclusions_only' }),
    ]);
    expect(result.summary.counts.warnings).toBe(2);
  });
});
