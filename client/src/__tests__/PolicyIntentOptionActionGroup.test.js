/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentOptionActionGroup from '@/components/policies/PolicyIntentOptionActionGroup.vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

function mountGroup(props = {}, slots = {}) {
  return mount(PolicyIntentOptionActionGroup, {
    props: {
      actionLabel: 'Add belongs-here genre',
      modelValue: '',
      optionLabel: 'Genre that defines this library',
      readiness: {
        canSubmit: true,
        reason: '',
      },
      section: {
        key: POLICY_INTENT_BUCKETS.IDENTITY,
        addLabel: 'Choose identity genre...',
        options: ['Family', 'Comedy'],
      },
      ...props,
    },
    slots,
  })
}

describe('PolicyIntentOptionActionGroup.vue', () => {
  it('renders the shared option select and primary action', async () => {
    const wrapper = mountGroup()

    expect(wrapper.text()).toContain('Genre that defines this library')
    expect(wrapper.text()).toContain('Add belongs-here genre')

    await wrapper.find('select').setValue('Comedy')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Comedy'])
    expect(wrapper.emitted('activate')).toHaveLength(1)
  })

  it('renders secondary actions in the action row slot', () => {
    const wrapper = mountGroup({}, {
      'secondary-actions': '<button type="button">Clear max rating</button>',
    })

    expect(wrapper.text()).toContain('Clear max rating')
    expect(wrapper.findAll('button')).toHaveLength(2)
  })
})
