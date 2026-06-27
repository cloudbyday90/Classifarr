/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyIntentChip from '@/components/policies/PolicyIntentChip.vue'

function mountChip(entryOverrides = {}, props = {}) {
  return mount(PolicyIntentChip, {
    props: {
      entry: {
        displayText: 'Belongs here: Family',
        preset_name: 'Family Template',
        signal_type: 'genres',
        source: 'intent_draft',
        canRemove: true,
        removeLabel: 'Remove Belongs here: Family',
        ...entryOverrides,
      },
      badgeClass: 'bg-green-900/30 text-green-300',
      canEdit: true,
      ...props,
    },
  })
}

describe('PolicyIntentChip.vue', () => {
  it('renders intent edits with inline provenance and remove action', async () => {
    const wrapper = mountChip()

    expect(wrapper.text()).toContain('Belongs here: Family')
    expect(wrapper.text()).toContain('(Family Template)')
    expect(wrapper.text()).toContain('Intent edit')
    expect(wrapper.attributes('title')).toBe('Added or changed in the intent-first policy builder.')

    await wrapper.find('button[aria-label="Remove Belongs here: Family"]').trigger('click')

    expect(wrapper.emitted('remove-entry')?.[0][0]).toMatchObject({
      displayText: 'Belongs here: Family',
      source: 'intent_draft',
    })
  })

  it('labels imported policy overrides distinctly', () => {
    const wrapper = mountChip({
      source: 'legacy_custom_signals',
      displayText: 'Maximum rating: PG-13',
    })

    expect(wrapper.text()).toContain('Policy override')
    expect(wrapper.attributes('title')).toBe('Imported from existing policy-specific custom signals.')
  })

  it('labels starter-template and fallback signals without exposing raw source keys', () => {
    expect(mountChip({ source: 'legacy_preset' }).text()).toContain('Starter template')
    expect(mountChip({ source: 'unexpected_source' }).text()).toContain('Template signal')
  })

  it('hides remove actions when editing is unavailable', () => {
    const wrapper = mountChip({}, { canEdit: false })

    expect(wrapper.find('button').exists()).toBe(false)
  })
})
