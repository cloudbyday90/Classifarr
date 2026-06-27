/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentGenreControl from '@/components/policies/PolicyIntentGenreControl.vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

function mountControl(sectionOverrides = {}) {
  return mount(PolicyIntentGenreControl, {
    props: {
      section: {
        key: POLICY_INTENT_BUCKETS.IDENTITY,
        addLabel: 'Choose identity genre...',
        options: ['Family', 'Comedy', 'Adventure'],
        ...sectionOverrides,
      },
    },
  })
}

describe('PolicyIntentGenreControl.vue', () => {
  it('adds belongs-here genres through an explicit action button', async () => {
    const wrapper = mountControl()

    expect(wrapper.text()).toContain('Genre that defines this library')
    expect(wrapper.text()).toContain('Add belongs-here genre')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()

    await wrapper.find('select').setValue('Family')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      value: 'Family',
    })
    expect(wrapper.find('select').element.value).toBe('')
  })

  it('labels helpful-match genre actions distinctly', async () => {
    const wrapper = mountControl({
      key: POLICY_INTENT_BUCKETS.COMPATIBILITY,
      addLabel: 'Choose helpful genre...',
    })

    expect(wrapper.text()).toContain('Genre that can support a match')
    expect(wrapper.text()).toContain('Add helpful genre')

    await wrapper.find('select').setValue('Comedy')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.COMPATIBILITY,
      value: 'Comedy',
    })
  })

  it('labels confidence boost genre actions distinctly', async () => {
    const wrapper = mountControl({
      key: POLICY_INTENT_BUCKETS.BOOSTERS,
      addLabel: 'Choose boost genre...',
    })

    expect(wrapper.text()).toContain('Genre that boosts confidence')
    expect(wrapper.text()).toContain('Add confidence boost')

    await wrapper.find('select').setValue('Adventure')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.BOOSTERS,
      value: 'Adventure',
    })
  })
})
