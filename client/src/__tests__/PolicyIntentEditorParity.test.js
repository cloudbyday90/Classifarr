/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import PolicyIntentEditor from '@/components/policies/PolicyIntentEditor.vue'
import { usePolicyIntentDraft } from '@/composables/usePolicyIntentDraft'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

const GENRES = ['Family', 'Comedy', 'Adventure']
const RATINGS = ['PG', 'PG-13', 'R']

function mountEditorWithDraft() {
  const selectedPresets = ref([{
    id: 7,
    preset_id: 7,
    name: 'Starter',
    weight: 1,
    customSignals: null,
  }])
  const draftState = usePolicyIntentDraft(selectedPresets)

  const wrapper = mount(PolicyIntentEditor, {
    props: {
      selectedPresets: selectedPresets.value,
      allPresets: [],
      intentDraft: draftState.intentDraft.value,
      availableGenres: GENRES,
      availableRatings: RATINGS,
    },
  })

  return {
    draftState,
    selectedPresets,
    wrapper,
  }
}

function findIntentSection(wrapper, sectionKey) {
  const section = wrapper.find(`#policy-intent-section-${sectionKey}`)
  expect(section.exists()).toBe(true)
  return section
}

async function activateSectionValue(wrapper, sectionKey, value, buttonText) {
  const section = findIntentSection(wrapper, sectionKey)
  const checkbox = section.find(`input[type="checkbox"][value="${value}"]`)
  if (checkbox.exists()) {
    await checkbox.setValue(true)
  } else {
    await section.find('select').setValue(value)
  }

  const action = section.findAll('button').find(button => button.text() === buttonText)
  expect(action).toBeTruthy()
  await action.trigger('click')
}

function latestEventPayload(wrapper, eventName) {
  const events = wrapper.emitted(eventName) || []
  return events[events.length - 1]?.[0]
}

describe('PolicyIntentEditor draft parity', () => {
  it.each([
    {
      name: 'belongs-here genres',
      sectionKey: POLICY_INTENT_BUCKETS.IDENTITY,
      value: 'Family',
      buttonText: 'Add belongs-here genre',
      eventName: 'draft-add-signal',
      apply: 'addSignal',
      expectedCustomSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity',
        },
      },
    },
    {
      name: 'helpful-match genres',
      sectionKey: POLICY_INTENT_BUCKETS.COMPATIBILITY,
      value: 'Comedy',
      buttonText: 'Add helpful genre',
      eventName: 'draft-add-signal',
      apply: 'addSignal',
      expectedCustomSignals: {
        genres: {
          require_any: ['Comedy'],
          semantics: 'compatibility',
        },
      },
    },
    {
      name: 'confidence-boost genres',
      sectionKey: POLICY_INTENT_BUCKETS.BOOSTERS,
      value: 'Adventure',
      buttonText: 'Add confidence boost',
      eventName: 'draft-add-signal',
      apply: 'addSignal',
      expectedCustomSignals: {
        genres: {
          prefer: ['Adventure'],
        },
      },
    },
    {
      name: 'maximum rating limits',
      sectionKey: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
      value: 'PG-13',
      buttonText: 'Set max rating',
      eventName: 'draft-set-signal-config',
      apply: 'setSignalConfig',
      expectedCustomSignals: {
        certifications: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict',
        },
      },
    },
    {
      name: 'avoid-rating exclusions',
      sectionKey: POLICY_INTENT_BUCKETS.EXCLUSIONS,
      value: 'R',
      buttonText: 'Add avoid rating',
      eventName: 'draft-set-signal-config',
      apply: 'setSignalConfig',
      expectedCustomSignals: {
        certifications: {
          mode: 'exclude',
          exclude: ['R'],
        },
      },
    },
  ])('keeps $name editor commands compatible with legacy customSignals', async ({
    apply,
    buttonText,
    eventName,
    expectedCustomSignals,
    sectionKey,
    value,
  }) => {
    const { draftState, selectedPresets, wrapper } = mountEditorWithDraft()

    await activateSectionValue(wrapper, sectionKey, value, buttonText)

    const payload = latestEventPayload(wrapper, eventName)
    expect(payload).toBeTruthy()
    expect(draftState[apply](payload)).toBe(true)
    expect(selectedPresets.value[0].customSignals).toEqual(expectedCustomSignals)
  })
})
