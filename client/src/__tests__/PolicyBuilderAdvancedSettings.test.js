/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyBuilderAdvancedSettings from '@/components/policies/PolicyBuilderAdvancedSettings.vue'
import { createDefaultPolicyForm } from '@/composables/usePolicyBuilderState'

const mountComponent = (overrides = {}) => {
  const form = {
    ...createDefaultPolicyForm(1),
    ...overrides.form,
  }

  return mount(PolicyBuilderAdvancedSettings, {
    props: {
      form,
      totalWeight: overrides.totalWeight ?? 1,
    },
  })
}

describe('PolicyBuilderAdvancedSettings.vue', () => {
  it('renders threshold controls by default and keeps advanced scoring collapsed', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('Classification Thresholds')
    expect(wrapper.text()).toContain('Auto-classify threshold: 85%')
    expect(wrapper.text()).toContain('Prompt threshold: 60%')
    expect(wrapper.text()).not.toContain('Scoring Weights')
  })

  it('renders scoring weights and combination modes when expanded', async () => {
    const wrapper = mountComponent()
    const disclosure = wrapper.find('button')

    expect(disclosure.attributes('aria-expanded')).toBe('false')
    expect(disclosure.attributes('aria-controls')).toMatch(/^policy-builder-advanced-settings-panel-/)

    await disclosure.trigger('click')

    expect(wrapper.text()).toContain('Scoring Weights')
    expect(wrapper.text()).toContain('Presets: 35%')
    expect(wrapper.text()).toContain('Profile: 25%')
    expect(wrapper.text()).toContain('Total: 100%')
    expect(wrapper.text()).toContain('Best Match')
    expect(wrapper.text()).toContain('Require All')
    expect(disclosure.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find(`#${disclosure.attributes('aria-controls')}`).exists()).toBe(true)
  })

  it('emits bounded form field update requests', async () => {
    const wrapper = mountComponent()

    const thresholdInputs = wrapper.findAll('input[type="range"]')
    await thresholdInputs[0].setValue('90')
    await thresholdInputs[1].setValue('70')

    await wrapper.find('button').trigger('click')
    const allRangeInputs = wrapper.findAll('input[type="range"]')
    await allRangeInputs[0].setValue('0.4')

    const requireAll = wrapper.find('input[value="require_all"]')
    await requireAll.setValue(true)

    expect(wrapper.emitted('update-field')).toEqual([
      [{ field: 'auto_classify_threshold', value: '90' }],
      [{ field: 'prompt_threshold', value: '70' }],
      [{ field: 'preset_weight', value: '0.4' }],
      [{ field: 'combination_mode', value: 'require_all' }],
    ])
  })

  it('shows a warning when scoring weights do not total 100 percent', async () => {
    const wrapper = mountComponent({ totalWeight: 0.85 })

    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Total: 85%')
    expect(wrapper.text()).toContain('(should equal 100%)')
  })
})
