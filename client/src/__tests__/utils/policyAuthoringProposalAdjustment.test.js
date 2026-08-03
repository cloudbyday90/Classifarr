/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyAuthoringProposalAdjustmentCommands,
  buildPolicyAuthoringProposalHelpfulStudioAdjustmentCommands,
  buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands,
  normalizePolicyAuthoringProposalAdjustmentCommands,
  normalizePolicyAuthoringProposalHelpfulStudioOptions,
  normalizePolicyAuthoringProposalPurposeGenreOptions,
} from '@/utils/policyAuthoringProposalAdjustment'

const options = [
  { value: 'Animation', sourceId: 'current_library_profile' },
  { value: 'Family', sourceId: 'current_library_profile' },
]
const helpfulStudioOptions = [
  { value: 'Studio Example', sourceId: 'current_library_profile' },
  { value: 'Studio Second', sourceId: 'current_library_profile' },
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

  it('combines independently narrowed current-profile genres and helpful studios in canonical command order', () => {
    expect(buildPolicyAuthoringProposalHelpfulStudioAdjustmentCommands({
      options: helpfulStudioOptions,
      selectedValues: ['Studio Example'],
    })).toEqual([{
      commandId: 'set_helpful_studios',
      values: ['Studio Example'],
    }])
    expect(buildPolicyAuthoringProposalAdjustmentCommands({
      purposeGenreOptions: options,
      selectedPurposeGenreValues: ['Animation'],
      helpfulStudioOptions,
      selectedHelpfulStudioValues: ['Studio Example'],
    })).toEqual([
      { commandId: 'set_purpose_genres', values: ['Animation'] },
      { commandId: 'set_helpful_studios', values: ['Studio Example'] },
    ])
  })

  it('fails closed for sources, values, and commands outside the typed proposal boundary', () => {
    expect(normalizePolicyAuthoringProposalPurposeGenreOptions([
      { value: 'Animation', sourceId: 'operator' },
    ])).toEqual([])
    expect(normalizePolicyAuthoringProposalHelpfulStudioOptions([
      { value: 'Studio Example', sourceId: 'operator' },
    ])).toEqual([])
    expect(buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands({
      options,
      selectedValues: ['Unknown'],
    })).toBeNull()
    expect(normalizePolicyAuthoringProposalAdjustmentCommands([{
      commandId: 'set_hard_limit',
      values: ['PG-13'],
    }])).toBeNull()
    expect(normalizePolicyAuthoringProposalAdjustmentCommands([
      { commandId: 'set_helpful_studios', values: ['Studio Example'] },
      { commandId: 'set_helpful_studios', values: ['Studio Second'] },
    ])).toBeNull()
  })
})
