/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  usePolicyAuthoringProposalAdjustmentState,
} from '@/composables/usePolicyAuthoringProposalAdjustmentState'

describe('usePolicyAuthoringProposalAdjustmentState', () => {
  it('retains only canonical allow-listed commands and clears them explicitly', () => {
    const state = usePolicyAuthoringProposalAdjustmentState()

    state.replace([
      { commandId: 'set_helpful_studios', values: ['Studio Example'] },
      { commandId: 'set_purpose_genres', values: ['Animation'] },
    ])

    expect(state.commands.value).toEqual([
      { commandId: 'set_purpose_genres', values: ['Animation'] },
      { commandId: 'set_helpful_studios', values: ['Studio Example'] },
    ])

    state.clear()
    expect(state.commands.value).toEqual([])
  })

  it('fails closed when a component supplies an unknown command', () => {
    const state = usePolicyAuthoringProposalAdjustmentState()

    state.replace([{ commandId: 'replace_policy', values: ['untrusted'] }])

    expect(state.commands.value).toEqual([])
  })
})
