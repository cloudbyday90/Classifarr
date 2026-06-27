/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentCertificationControl from '@/components/policies/PolicyIntentCertificationControl.vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

function mountControl(sectionOverrides = {}) {
  return mount(PolicyIntentCertificationControl, {
    props: {
      section: {
        key: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
        addLabel: 'Choose max rating...',
        options: ['PG', 'PG-13', 'R'],
        hasClearAction: true,
        ...sectionOverrides,
      },
    },
  })
}

describe('PolicyIntentCertificationControl.vue', () => {
  it('sets max-rating values through an explicit action button', async () => {
    const wrapper = mountControl()

    expect(wrapper.text()).toContain('Maximum allowed rating')
    expect(wrapper.text()).toContain('Set max rating')

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()

    await wrapper.find('select').setValue('PG-13')
    await button.trigger('click')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
      value: 'PG-13',
    })
    expect(wrapper.find('select').element.value).toBe('')
  })

  it('emits clear-section only for sections that support max-rating clearing', async () => {
    const wrapper = mountControl()
    const buttons = wrapper.findAll('button')

    await buttons[1].trigger('click')

    expect(wrapper.emitted('clear-section')?.[0]).toEqual([
      POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
    ])
  })

  it('adds avoid ratings without showing max-rating clear controls', async () => {
    const wrapper = mountControl({
      key: POLICY_INTENT_BUCKETS.EXCLUSIONS,
      addLabel: 'Choose rating to avoid...',
      hasClearAction: false,
    })

    expect(wrapper.text()).toContain('Rating to avoid')
    expect(wrapper.text()).toContain('Add avoid rating')
    expect(wrapper.text()).not.toContain('Clear max rating')

    await wrapper.find('select').setValue('R')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.EXCLUSIONS,
      value: 'R',
    })
  })

  it('disables duplicate certification options and blocks duplicate emissions', async () => {
    const wrapper = mountControl({
      key: POLICY_INTENT_BUCKETS.EXCLUSIONS,
      addLabel: 'Choose rating to avoid...',
      hasClearAction: false,
      optionStates: [
        {
          value: 'R',
          label: 'R',
          disabled: true,
          reason: 'R is already configured as an avoid rating.',
        },
        {
          value: 'PG-13',
          label: 'PG-13',
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
    expect(options[1].text()).toContain('R is already configured as an avoid rating.')

    await wrapper.find('select').setValue('R')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')).toBeUndefined()
  })

  it('explains when all rating options are already configured', () => {
    const wrapper = mountControl({
      optionStates: [
        {
          value: 'PG-13',
          label: 'PG-13',
          disabled: true,
          reason: 'PG-13 is already set as the maximum rating.',
        },
      ],
      optionDiagnostics: {
        status: 'all_configured',
        message: 'The available max rating is already configured.',
      },
    })

    expect(wrapper.text()).toContain('The available max rating is already configured.')
  })

  it('explains when rating reference options are missing', () => {
    const wrapper = mountControl({
      options: [],
      optionStates: [],
      optionDiagnostics: {
        status: 'missing_reference_options',
        message: 'No rating options are available yet. Sync or attach presets with certification signals before configuring this rating control.',
      },
    })

    expect(wrapper.text()).toContain('No rating options are available yet.')
  })
})
