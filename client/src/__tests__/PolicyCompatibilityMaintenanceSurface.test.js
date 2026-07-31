/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import PolicyCompatibilityMaintenanceSurface from '@/components/policies/PolicyCompatibilityMaintenanceSurface.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'

const baseProps = {
  intentSummary: {
    has_warnings: false,
    sections: [],
  },
  selectedPresets: [{ id: 7, name: 'Family' }],
  allPresets: [{ id: 7, name: 'Family' }],
  intentDraft: { schema_version: 1 },
  availableGenres: ['Family'],
  availableGenreOptions: [{ value: 'Family', label: 'Family' }],
  availableRatings: ['PG'],
}

function mountSurface(overrides = {}) {
  return shallowMount(PolicyCompatibilityMaintenanceSurface, {
    props: {
      ...baseProps,
      ...overrides,
    },
  })
}

describe('PolicyCompatibilityMaintenanceSurface.vue', () => {
  it('labels the retained editor as compatibility maintenance', () => {
    const wrapper = mountSurface()

    expect(wrapper.find('#policy-compatibility-maintenance').attributes('aria-labelledby'))
      .toBe('policy-compatibility-maintenance-title')
    expect(wrapper.find('#policy-compatibility-maintenance-title').text())
      .toBe('Compatibility policy maintenance')
    expect(wrapper.find('[role="status"]').text())
      .toContain('New policies use destination-first setup')
    expect(wrapper.find('#policy-builder-intent-editor').attributes('aria-label'))
      .toBe('Compatibility policy intent editor')
    expect(wrapper.text()).toContain('preserves its decision behavior')
    expect(wrapper.text()).not.toContain('Advanced Settings')
    expect(wrapper.text()).not.toContain('Scoring Weights')
    expect(wrapper.text()).not.toContain('Classification Thresholds')
  })

  it('forwards retained compatibility intent commands without raw scoring updates', () => {
    const wrapper = mountSurface()
    const editor = wrapper.findComponent(PolicyIntentEditor)

    editor.vm.$emit('draft-add-signal', {
      presetId: 7,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
    })

    expect(wrapper.emitted('draft-add-signal')).toEqual([[
      {
        presetId: 7,
        signalType: 'genres',
        key: 'require_any',
        value: 'Family',
      },
    ]])
    expect(wrapper.emitted('update-field')).toBeUndefined()
  })

  it('keeps migration acknowledgement inside the maintenance boundary', () => {
    const wrapper = mountSurface({
      presetMigrationNotice: {
        summary: 'One compatibility attachment was removed.',
        preview: '',
      },
    })

    const notice = wrapper.findComponent(PolicyPresetMigrationNotice)
    expect(notice.exists()).toBe(true)

    notice.vm.$emit('dismiss')

    expect(wrapper.emitted('dismiss-migration-notice')).toEqual([[]])
  })
})
