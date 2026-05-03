/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unit tests for preset signal normalization and runtime semantics helpers.
 */

import {
  normalizeSignalConfig,
  mergePresetSignals,
  describePresetRuntimeSemantics
} from '../utils/policySignals.mjs';

describe('policySignals utilities', () => {
  describe('normalizeSignalConfig', () => {
    test('returns null for falsy and invalid JSON values', () => {
      expect(normalizeSignalConfig(null)).toBeNull();
      expect(normalizeSignalConfig('')).toBeNull();
      expect(normalizeSignalConfig('{oops')).toBeNull();
      expect(normalizeSignalConfig('"text"')).toBeNull();
      expect(normalizeSignalConfig('[1,2,3]')).toEqual([1, 2, 3]);
    });

    test('parses JSON objects and preserves object inputs', () => {
      expect(normalizeSignalConfig('{"language":{"require_any":["sv"]}}')).toEqual({
        language: { require_any: ['sv'] }
      });

      const input = { genres: { require_any: ['Comedy'] } };
      expect(normalizeSignalConfig(input)).toBe(input);
    });
  });

  describe('mergePresetSignals', () => {
    test('merges arrays, scalars, and removed entries', () => {
      const merged = mergePresetSignals(
        {
          language: {
            require_any: ['sv', 'no'],
            exclude: ['en'],
            weight: 2
          },
          keywords: {
            prefer: ['funny', 'standup']
          }
        },
        {
          removed: {
            keywords: {
              prefer: ['standup']
            }
          },
          language: {
            require_any: ['da'],
            strict: false
          },
          keywords: {
            prefer: ['satire']
          }
        }
      );

      expect(merged).toEqual({
        language: {
          require_any: ['sv', 'no', 'da'],
          exclude: ['en'],
          weight: 2,
          strict: false
        },
        keywords: {
          prefer: ['funny', 'satire']
        }
      });
    });

    test('returns a cloned base config when there are no custom signals', () => {
      const base = {
        genres: { require_any: ['Documentary'] }
      };

      const merged = mergePresetSignals(base, null);
      expect(merged).toEqual(base);
      expect(merged).not.toBe(base);
    });

    test('ignores removed entries for missing signal groups and non-array keys', () => {
      const merged = mergePresetSignals(
        {
          language: {
            strict: true,
            weight: 2
          }
        },
        {
          removed: {
            keywords: {
              prefer: ['funny']
            },
            language: {
              strict: [true]
            }
          }
        }
      );

      expect(merged).toEqual({
        language: {
          strict: true,
          weight: 2
        }
      });
    });

    test('accepts JSON string configs for both base and custom payloads', () => {
      const merged = mergePresetSignals(
        '{"language":{"require_any":["sv"]}}',
        '{"language":{"exclude":["en"],"strict":false}}'
      );

      expect(merged).toEqual({
        language: {
          require_any: ['sv'],
          exclude: ['en'],
          strict: false
        }
      });
    });

    test('removes values from existing arrays when removed entries target a real key', () => {
      const merged = mergePresetSignals(
        {
          keywords: {
            prefer: ['funny', 'standup', 'satire']
          }
        },
        {
          removed: {
            keywords: {
              prefer: ['standup']
            }
          }
        }
      );

      expect(merged).toEqual({
        keywords: {
          prefer: ['funny', 'satire']
        }
      });
    });
  });

  describe('describePresetRuntimeSemantics', () => {
    test('returns not_applicable when no language constraints exist', () => {
      expect(describePresetRuntimeSemantics(
        { genres: { require_any: ['Comedy'] } },
        null
      )).toEqual({
        migration_state: 'not_applicable',
        review_recommended: false,
        badge_label: null,
        badge_tone: null,
        summary: null
      });
    });

    test('marks inherited strict language presets as strict_inherited', () => {
      expect(describePresetRuntimeSemantics(
        { language: { require_any: ['sv'], strict: true } },
        null
      )).toEqual(expect.objectContaining({
        migration_state: 'strict_inherited',
        review_recommended: false,
        badge_label: 'Strict runtime',
        required_languages: ['sv']
      }));
    });

    test('marks explicit strict override as strict_override', () => {
      expect(describePresetRuntimeSemantics(
        { language: { require_any: ['sv'] } },
        { language: { strict: true } }
      )).toEqual(expect.objectContaining({
        migration_state: 'strict_override',
        review_recommended: false,
        badge_label: 'Strict runtime'
      }));
    });

    test('marks explicit advisory override when strict is disabled', () => {
      expect(describePresetRuntimeSemantics(
        { language: { require_any: ['sv'], strict: true } },
        { language: { strict: false } }
      )).toEqual(expect.objectContaining({
        migration_state: 'advisory_override',
        review_recommended: false,
        badge_label: 'Advisory runtime',
        required_languages: ['sv']
      }));
    });

    test('marks default advisory migration state for legacy language presets', () => {
      expect(describePresetRuntimeSemantics(
        { language: { require_any: ['sv'], exclude: ['en'] } },
        null
      )).toEqual(expect.objectContaining({
        migration_state: 'advisory_defaulted',
        review_recommended: true,
        badge_label: 'Review runtime',
        required_languages: ['sv'],
        excluded_languages: ['en']
      }));
    });

    test('preserves inherited strict presets when custom language changes do not explicitly disable strict mode', () => {
      expect(describePresetRuntimeSemantics(
        { language: { require_any: ['sv'], strict: true } },
        { language: { exclude: ['en'] } }
      )).toEqual(expect.objectContaining({
        migration_state: 'strict_inherited',
        review_recommended: false,
        required_languages: ['sv'],
        excluded_languages: ['en']
      }));
    });

    test('accepts JSON string payloads when describing runtime semantics', () => {
      expect(describePresetRuntimeSemantics(
        '{"language":{"require_any":["ja"]}}',
        '{"language":{"exclude":["en"]}}'
      )).toEqual(expect.objectContaining({
        migration_state: 'advisory_defaulted',
        required_languages: ['ja'],
        excluded_languages: ['en']
      }));
    });

    test('handles exclude-only strict presets as strict_inherited', () => {
      expect(describePresetRuntimeSemantics(
        { language: { exclude: ['en'], strict: true } },
        null
      )).toEqual(expect.objectContaining({
        migration_state: 'strict_inherited',
        excluded_languages: ['en'],
        review_recommended: false
      }));
    });

    test('marks exclude-only legacy presets as advisory_defaulted', () => {
      expect(describePresetRuntimeSemantics(
        { language: { exclude: ['en'] } },
        null
      )).toEqual(expect.objectContaining({
        migration_state: 'advisory_defaulted',
        excluded_languages: ['en'],
        review_recommended: true
      }));
    });
  });
});
