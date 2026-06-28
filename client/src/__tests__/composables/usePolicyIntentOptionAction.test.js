/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { usePolicyIntentOptionAction } from '@/composables/usePolicyIntentOptionAction'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

function createSection(overrides = {}) {
  return {
    key: POLICY_INTENT_BUCKETS.IDENTITY,
    options: ['Family', 'Comedy'],
    optionDiagnostics: {
      status: 'available',
      optionKind: 'genre',
    },
    ...overrides,
  }
}

describe('usePolicyIntentOptionAction', () => {
  it('derives option states and readiness from a reactive section', () => {
    const section = ref(createSection())
    const action = usePolicyIntentOptionAction(section)

    expect(action.optionStates.value).toEqual([
      {
        value: 'Family',
        label: 'Family',
        disabled: false,
        reason: '',
      },
      {
        value: 'Comedy',
        label: 'Comedy',
        disabled: false,
        reason: '',
      },
    ])
    expect(action.controlReadiness.value).toEqual({
      canSubmit: false,
      status: 'missing_selection',
      reason: 'Choose a belongs-here genre before applying this edit.',
    })

    section.value = createSection({
      optionStates: [{
        value: 'Family',
        label: 'Family',
        disabled: true,
        reason: 'Family is already configured as a belongs-here genre.',
      }],
      optionDiagnostics: {
        status: 'all_configured',
        optionKind: 'genre',
        message: 'All available genre options are already configured in this section.',
      },
    })

    expect(action.optionStates.value[0].disabled).toBe(true)
    expect(action.controlReadiness.value.reason).toBe('All available genre options are already configured in this section.')
  })

  it('emits valid selected values and resets local state', () => {
    const onAddValue = vi.fn()
    const action = usePolicyIntentOptionAction(ref(createSection()), onAddValue)

    action.selectedValue.value = 'Family'

    expect(action.submitSelectedValue()).toBe(true)
    expect(onAddValue).toHaveBeenCalledWith({
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      value: 'Family',
    })
    expect(action.selectedValue.value).toBe('')
  })

  it('emits multiple selected values and resets array state in multi-select mode', () => {
    const onAddValue = vi.fn()
    const action = usePolicyIntentOptionAction(ref(createSection()), onAddValue, { multiple: true })

    action.selectedValue.value = ['Family', 'Comedy', 'Family']

    expect(action.submitSelectedValue()).toBe(true)
    expect(onAddValue).toHaveBeenCalledTimes(2)
    expect(onAddValue).toHaveBeenNthCalledWith(1, {
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      value: 'Family',
    })
    expect(onAddValue).toHaveBeenNthCalledWith(2, {
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      value: 'Comedy',
    })
    expect(action.selectedValue.value).toEqual([])
  })

  it('blocks invalid or disabled selections before emitting', () => {
    const onAddValue = vi.fn()
    const action = usePolicyIntentOptionAction(ref(createSection({
      optionStates: [{
        value: 'Family',
        label: 'Family',
        disabled: true,
        reason: 'Family is already configured as a belongs-here genre.',
      }],
      optionDiagnostics: {
        status: 'limited',
        optionKind: 'genre',
      },
    })), onAddValue)

    action.selectedValue.value = 'Family'

    expect(action.submitSelectedValue()).toBe(false)
    expect(onAddValue).not.toHaveBeenCalled()
  })
})
