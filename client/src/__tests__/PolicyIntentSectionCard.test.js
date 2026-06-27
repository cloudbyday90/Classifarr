/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentSectionCard from '@/components/policies/PolicyIntentSectionCard.vue'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

function mountCard(overrides = {}) {
  return mount(PolicyIntentSectionCard, {
    props: {
      section: {
        key: POLICY_INTENT_BUCKETS.IDENTITY,
        label: 'Belongs Here',
        help: 'Signals that define what this library is for.',
        entries: [{
          role: POLICY_INTENT_BUCKETS.IDENTITY,
          preset_id: 7,
          preset_name: 'Family Template',
          signal_type: 'genres',
          values: { require_any: ['Family'] },
        }],
        options: ['Family', 'Animation'],
        actionLabel: 'Add a belongs-here genre',
        actionHelp: 'Use this for identity evidence that should define the destination.',
        addLabel: 'Choose identity genre...',
        badgeClass: 'bg-green-900/30 text-green-300',
        hasClearAction: false,
      },
      canEdit: true,
      ...overrides.props,
    },
  })
}

describe('PolicyIntentSectionCard.vue', () => {
  it('renders section copy, entries, and source template labels', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Belongs Here')
    expect(wrapper.text()).toContain('Signals that define what this library is for.')
    expect(wrapper.text()).toContain('genres: Family')
    expect(wrapper.text()).toContain('(Family Template)')
    expect(wrapper.text()).toContain('Add a belongs-here genre')
    expect(wrapper.text()).toContain('Use this for identity evidence that should define the destination.')
  })

  it('emits add-value payloads and resets the select', async () => {
    const wrapper = mountCard()
    const select = wrapper.find('select')

    await select.setValue('Animation')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      value: 'Animation',
    })
    expect(select.element.value).toBe('')
  })

  it('renders clear controls only when supported', async () => {
    const wrapper = mountCard({
      props: {
        section: {
          key: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
          label: 'Hard Limits',
          help: 'Rules that can block a match.',
          entries: [],
          options: ['PG-13'],
          actionLabel: 'Set maximum allowed rating',
          actionHelp: 'Items above this rating should require review or be blocked by policy logic.',
          addLabel: 'Choose max rating...',
          badgeClass: 'bg-amber-900/30 text-amber-300',
          hasClearAction: true,
        },
      },
    })

    expect(wrapper.text()).toContain('No configured signals.')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('clear-section')?.[0]).toEqual([POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS])
  })

  it('hides edit controls when editing is unavailable', () => {
    const wrapper = mountCard({
      props: {
        canEdit: false,
      },
    })

    expect(wrapper.find('select').exists()).toBe(false)
  })
})
