/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentOptionSelect from '@/components/policies/PolicyIntentOptionSelect.vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

function mountSelect(sectionOverrides = {}, modelValue = '') {
  return mount(PolicyIntentOptionSelect, {
    props: {
      label: 'Genre that defines this library',
      modelValue,
      section: {
        key: POLICY_INTENT_BUCKETS.IDENTITY,
        addLabel: 'Choose identity genre...',
        options: ['Family', 'Comedy'],
        ...sectionOverrides,
      },
    },
  })
}

describe('PolicyIntentOptionSelect.vue', () => {
  it('renders label, placeholder, and fallback section options', () => {
    const wrapper = mountSelect()

    expect(wrapper.text()).toContain('Genre that defines this library')
    expect(wrapper.findAll('option').map(option => option.text())).toEqual([
      'Choose identity genre...',
      'Family',
      'Comedy',
    ])
  })

  it('renders disabled option reasons and section diagnostics', () => {
    const wrapper = mountSelect({
      optionStates: [
        {
          value: 'Family',
          label: 'Family',
          disabled: true,
          reason: 'Family is already configured as a belongs-here genre.',
        },
      ],
      optionDiagnostics: {
        status: 'all_configured',
        message: 'All available genre options are already configured in this section.',
      },
    })

    const disabledOption = wrapper.findAll('option')[1]
    expect(disabledOption.attributes('disabled')).toBeDefined()
    expect(disabledOption.attributes('title')).toBe('Family is already configured as a belongs-here genre.')
    expect(disabledOption.text()).toContain('Family is already configured as a belongs-here genre.')
    expect(wrapper.text()).toContain('All available genre options are already configured in this section.')
  })

  it('emits selected values through the component v-model contract', async () => {
    const wrapper = mountSelect()

    await wrapper.find('select').setValue('Comedy')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Comedy'])
  })
})
