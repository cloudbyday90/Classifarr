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
        behaviorSummary: 'This destination is defined by Family.',
        entries: [{
          role: POLICY_INTENT_BUCKETS.IDENTITY,
          preset_id: 7,
          preset_name: 'Family Template',
          signal_type: 'genres',
          values: { require_any: ['Family'] },
          displayText: 'Belongs here: Family',
          source: 'intent_draft',
          canRemove: true,
          removeLabel: 'Remove Belongs here: Family',
        }],
        options: ['Family', 'Animation'],
        controlKind: 'genre_intent',
        actionLabel: 'Add a belongs-here genre',
        actionHelp: 'Use this for identity evidence that should define the destination.',
        addLabel: 'Choose identity genre...',
        badgeClass: 'bg-green-900/30 text-green-300',
        completion: {
          status: 'configured',
          tone: 'success',
          label: 'Configured',
          description: 'This section has configured intent signals.',
        },
        nextAction: 'Next: add helpful matches only if they support this identity without replacing it.',
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
    expect(wrapper.text()).toContain('Configured')
    expect(wrapper.find('.text-green-200').exists()).toBe(true)
    expect(wrapper.text()).toContain('Next: add helpful matches only if they support this identity without replacing it.')
    expect(wrapper.text()).toContain('This destination is defined by Family.')
    expect(wrapper.text()).toContain('Belongs here: Family')
    expect(wrapper.text()).not.toContain('genres: Family')
    expect(wrapper.text()).toContain('(Family Template)')
    expect(wrapper.text()).toContain('Intent edit')
    expect(wrapper.text()).toContain('Add a belongs-here genre')
    expect(wrapper.text()).toContain('Use this for identity evidence that should define the destination.')
  })

  it('renders deterministic weak-section warnings', () => {
    const wrapper = mountCard({
      props: {
        section: {
          key: POLICY_INTENT_BUCKETS.IDENTITY,
          label: 'Belongs Here',
          help: 'Signals that define what this library is for.',
          behaviorSummary: '',
          warnings: [{
            code: 'missing_identity',
            severity: 'warning',
            message: 'Add at least one belongs-here signal so this policy has a clear destination identity.',
            consequence: 'Without identity evidence, broad hints and RAG neighbors are more likely to force manual review.',
          }],
          entries: [],
          options: ['Family'],
          controlKind: 'genre_intent',
          actionLabel: 'Add a belongs-here genre',
          actionHelp: 'Use this for identity evidence that should define the destination.',
          addLabel: 'Choose identity genre...',
          badgeClass: 'bg-green-900/30 text-green-300',
          completion: {
            status: 'needs_identity',
            tone: 'warning',
            label: 'Needs identity',
            description: 'Add a belongs-here signal before relying on this policy.',
          },
          nextAction: 'Next: add a belongs-here genre that clearly defines this destination.',
          hasClearAction: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Add at least one belongs-here signal so this policy has a clear destination identity.')
    expect(wrapper.text()).toContain('Needs identity')
    expect(wrapper.text()).toContain('Next: add a belongs-here genre that clearly defines this destination.')
    expect(wrapper.text()).toContain('Why it matters: Without identity evidence, broad hints and RAG neighbors are more likely to force manual review.')
    expect(wrapper.find('.text-amber-200').exists()).toBe(true)
  })

  it('emits add-value payloads and resets the select', async () => {
    const wrapper = mountCard()
    const select = wrapper.find('select')

    await select.setValue('Animation')
    await wrapper.findAll('button').find(button => button.text() === 'Add belongs-here genre').trigger('click')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      value: 'Animation',
    })
    expect(select.element.value).toBe('')
  })

  it('emits remove-entry only for editable removable entries', async () => {
    const wrapper = mountCard()
    const removeButton = wrapper.find('button[aria-label="Remove Belongs here: Family"]')

    await removeButton.trigger('click')

    expect(wrapper.emitted('remove-entry')?.[0][0]).toMatchObject({
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      entry: {
        preset_id: 7,
        signal_type: 'genres',
        values: { require_any: ['Family'] },
      },
    })
  })

  it('renders clear controls only when supported', async () => {
    const wrapper = mountCard({
      props: {
        section: {
          key: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
          label: 'Hard Limits',
          help: 'Rules that can block a match.',
          behaviorSummary: '',
          entries: [],
          options: ['PG-13'],
          controlKind: 'certification',
          actionLabel: 'Set maximum allowed rating',
          actionHelp: 'Items above this rating should require review or be blocked by policy logic.',
          addLabel: 'Choose max rating...',
          badgeClass: 'bg-amber-900/30 text-amber-300',
          hasClearAction: true,
        },
      },
    })

    expect(wrapper.text()).toContain('No configured signals.')
    expect(wrapper.text()).toContain('Maximum allowed rating')
    expect(wrapper.text()).toContain('Set max rating')
    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('clear-section')?.[0]).toEqual([POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS])
  })

  it('delegates certification additions through the focused certification control', async () => {
    const wrapper = mountCard({
      props: {
        section: {
          key: POLICY_INTENT_BUCKETS.EXCLUSIONS,
          label: 'Avoid',
          help: 'Signals that lower confidence.',
          behaviorSummary: '',
          entries: [],
          options: ['PG-13', 'R'],
          controlKind: 'certification',
          actionLabel: 'Add an avoid rating',
          actionHelp: 'Use this for ratings that should count against this destination.',
          addLabel: 'Choose rating to avoid...',
          badgeClass: 'bg-red-900/30 text-red-300',
          hasClearAction: false,
        },
      },
    })

    await wrapper.find('select').setValue('R')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('add-value')?.[0][0]).toEqual({
      sectionKey: POLICY_INTENT_BUCKETS.EXCLUSIONS,
      value: 'R',
    })
  })

  it('hides edit controls when editing is unavailable', () => {
    const wrapper = mountCard({
      props: {
        canEdit: false,
      },
    })

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Remove Belongs here: Family"]').exists()).toBe(false)
  })
})
