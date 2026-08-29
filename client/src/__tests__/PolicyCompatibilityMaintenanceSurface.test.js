/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import PolicyCompatibilityMaintenanceSurface from '@/components/policies/PolicyCompatibilityMaintenanceSurface.vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import PolicyPresetMigrationNotice from '@/components/policies/PolicyPresetMigrationNotice.vue'
import PolicyCompatibilityProfilePurposeSuggestion from '@/components/policies/PolicyCompatibilityProfilePurposeSuggestion.vue'
import PolicyDestinationCompetitionPreview from '@/components/policies/PolicyDestinationCompetitionPreview.vue'

const baseProps = {
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
  it('uses one context-first purpose statement for compatibility maintenance', () => {
    const wrapper = mountSurface()

    expect(wrapper.find('#policy-compatibility-maintenance').attributes('aria-labelledby'))
      .toBe('policy-compatibility-maintenance-title')
    expect(wrapper.find('#policy-compatibility-maintenance').attributes('aria-describedby'))
      .toBe('policy-compatibility-maintenance-description')
    expect(wrapper.find('#policy-compatibility-maintenance-title').text())
      .toBe('Maintain existing policy')
    expect(wrapper.find('#policy-compatibility-maintenance-description').text())
      .toBe('Choose a policy context, then make only the destination changes you need.')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('#policy-builder-intent-editor').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('preserves its decision behavior')
    expect(wrapper.text()).not.toContain('New policies use destination-first setup')
    expect(wrapper.text()).not.toContain('does not establish native policy intent')
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

  it('forwards explicit profile-suggestion acceptance without performing a save', async () => {
    const wrapper = mountSurface({
      profilePurposeSuggestion: {
        statusId: 'available',
        available: true,
        suggestion: { rules: [] },
      },
    })
    await vi.dynamicImportSettled()
    await flushPromises()
    const profileSuggestion = wrapper.findComponent(PolicyCompatibilityProfilePurposeSuggestion)

    profileSuggestion.vm.$emit('apply')

    expect(wrapper.emitted('apply-profile-purpose-suggestion')).toEqual([[]])
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('forwards an explicit destination-competition preview request without saving', () => {
    const wrapper = mountSurface({
      destinationCompetitionPreviewAvailable: true,
    })
    const destinationCompetitionPreview = wrapper.findComponent(PolicyDestinationCompetitionPreview)

    destinationCompetitionPreview.vm.$emit('preview')

    expect(wrapper.emitted('preview-destination-competition')).toEqual([[]])
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
