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
    expect(wrapper.find('button').attributes('title')).toBe('Choose a belongs-here genre before applying this edit.')
    expect(wrapper.find('button').attributes('aria-label')).toBe('Add belongs-here genre: Choose a belongs-here genre before applying this edit.')

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

  it('disables duplicate genre options and blocks duplicate emissions', async () => {
    const wrapper = mountControl({
      optionStates: [
        {
          value: 'Family',
          label: 'Family',
          disabled: true,
          reason: 'Family is already configured as a belongs-here genre.',
        },
        {
          value: 'Comedy',
          label: 'Comedy',
          disabled: false,
          reason: '',
        },
      ],
      optionDiagnostics: {
        status: 'limited',
        message: '1 already configured value is disabled; 1 choice remains available.',
      },
    })

    const options = wrapper.findAll('option')
    expect(options[1].attributes('disabled')).toBeDefined()
    expect(options[1].text()).toContain('Family is already configured as a belongs-here genre.')

    await wrapper.find('select').setValue('Family')
    expect(wrapper.find('button').attributes('title')).toBe('Family is already configured as a belongs-here genre.')
    expect(wrapper.find('button').attributes('aria-label')).toBe('Add belongs-here genre: Family is already configured as a belongs-here genre.')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')).toBeUndefined()
  })

  it('explains when all genre options are already configured', () => {
    const wrapper = mountControl({
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

    expect(wrapper.text()).toContain('All available genre options are already configured in this section.')
    expect(wrapper.find('button').attributes('title')).toBe('All available genre options are already configured in this section.')
  })

  it('explains when genre reference options are missing', () => {
    const wrapper = mountControl({
      options: [],
      optionStates: [],
      optionDiagnostics: {
        status: 'missing_reference_options',
        message: 'No genre options are available yet. Sync or attach presets with genre signals before adding this intent value.',
      },
    })

    expect(wrapper.text()).toContain('No genre options are available yet.')
  })
})
