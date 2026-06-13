import { describe, expect, it } from 'vitest'
import {
  POLICY_INTENT_BUCKETS,
  buildPolicyIntentView,
} from '../../utils/policyIntentModel'

describe('policyIntentModel', () => {
  it('groups merged preset signals by policy intent', () => {
    const selectedPresets = [{
      id: 7,
      preset_id: 7,
      name: 'Family',
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity',
        },
        keywords: {
          require_any: ['coming of age'],
          semantics: 'compatibility',
        },
        certifications: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict',
        },
      },
    }]

    const result = buildPolicyIntentView(selectedPresets, [{
      id: 7,
      signals: {
        genres: { prefer: ['Animation'] },
        language: { exclude: ['ja'] },
      },
    }])

    expect(result[POLICY_INTENT_BUCKETS.IDENTITY]).toEqual([
      expect.objectContaining({
        signal_type: 'genres',
        semantics: 'identity',
        values: expect.objectContaining({ require_any: ['Family'] }),
      }),
    ])
    expect(result[POLICY_INTENT_BUCKETS.COMPATIBILITY]).toEqual([
      expect.objectContaining({
        signal_type: 'keywords',
        semantics: 'compatibility',
      }),
    ])
    expect(result[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]).toEqual([
      expect.objectContaining({
        signal_type: 'certifications',
        constraint_mode: 'strict',
      }),
    ])
    expect(result[POLICY_INTENT_BUCKETS.BOOSTERS]).toEqual([
      expect.objectContaining({
        signal_type: 'genres',
        values: expect.objectContaining({ prefer: ['Animation'] }),
      }),
    ])
    expect(result[POLICY_INTENT_BUCKETS.EXCLUSIONS]).toEqual([
      expect.objectContaining({
        signal_type: 'language',
        values: expect.objectContaining({ exclude: ['ja'] }),
      }),
    ])
  })

  it('honors removed base signal values when projecting intent', () => {
    const result = buildPolicyIntentView([{
      id: 3,
      preset_id: 3,
      name: 'Comedy',
      customSignals: {
        removed: {
          genres: {
            prefer: ['Comedy'],
          },
        },
      },
    }], [{
      id: 3,
      signals: {
        genres: { prefer: ['Comedy'] },
      },
    }])

    expect(result[POLICY_INTENT_BUCKETS.BOOSTERS]).toEqual([])
  })
})
