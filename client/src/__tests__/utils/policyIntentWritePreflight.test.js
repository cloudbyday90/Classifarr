/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyIntentWritePreflightNotice,
  clonePolicyIntentDraftForWrite,
  normalizePolicyIntentWritePreflight,
} from '@/utils/policyIntentWritePreflight'

describe('policyIntentWritePreflight utilities', () => {
  it('clones policy intent drafts before write payload submission', () => {
    const draft = {
      schema_version: 1,
      presets: [{
        preset_id: 5,
        buckets: {},
      }],
    }

    const cloned = clonePolicyIntentDraftForWrite(draft)

    expect(cloned).toEqual(draft)
    expect(cloned).not.toBe(draft)
    expect(cloned.presets[0]).not.toBe(draft.presets[0])
  })

  it('normalizes sanitized server preflight diagnostics', () => {
    expect(normalizePolicyIntentWritePreflight({
      present: true,
      validation: {
        valid: true,
      },
      persistence_enabled: false,
      persistence_reason_code: 'legacy_draft_sidecar_not_persisted',
      draft_schema_version: '1',
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      preset_count: '2',
      draft: {
        should_not_survive: true,
      },
    })).toEqual({
      present: true,
      validation: {
        valid: true,
        errors: [],
      },
      persistence_enabled: false,
      persistence_reason_code: 'legacy_draft_sidecar_not_persisted',
      draft_schema_version: 1,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      preset_count: 2,
    })
  })

  it('builds non-persistent compatibility save copy', () => {
    expect(buildPolicyIntentWritePreflightNotice({
      present: true,
      validation: {
        valid: true,
        errors: [],
      },
      persistence_enabled: false,
      persistence_reason_code: 'legacy_draft_sidecar_not_persisted',
      draft_schema_version: 1,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      preset_count: 1,
    })).toEqual({
      tone: 'info',
      title: 'Compatibility save confirmed',
      message: 'The server validated 1 starter template as an intent draft but did not store that draft as native authority. The policy was saved through the legacy-compatible preset path.',
    })
  })
})
