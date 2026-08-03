/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands,
  normalizePolicyAuthoringProposalAdjustmentCommands,
  normalizePolicyAuthoringProposalPurposeGenreOptions,
} from '@/utils/policyAuthoringProposalAdjustment'

const options = [
  { value: 'Animation', sourceId: 'current_library_profile' },
  { value: 'Family', sourceId: 'current_library_profile' },
]

describe('policyAuthoringProposalAdjustment', () => {
  it('creates one typed narrowing command only when selected genres differ from the proposal', () => {
    expect(buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands({
      options,
      selectedValues: ['Animation', 'Family'],
    })).toEqual([])

    expect(buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands({
      options,
      selectedValues: ['Animation'],
    })).toEqual([{
      commandId: 'set_purpose_genres',
      values: ['Animation'],
    }])
  })

  it('fails closed for sources, values, and commands outside the typed proposal boundary', () => {
    expect(normalizePolicyAuthoringProposalPurposeGenreOptions([
      { value: 'Animation', sourceId: 'operator' },
    ])).toEqual([])
    expect(buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands({
      options,
      selectedValues: ['Unknown'],
    })).toBeNull()
    expect(normalizePolicyAuthoringProposalAdjustmentCommands([{
      commandId: 'set_hard_limit',
      values: ['PG-13'],
    }])).toBeNull()
  })
})
