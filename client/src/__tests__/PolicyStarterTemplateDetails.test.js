/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyStarterTemplateDetails from '@/components/policies/PolicyStarterTemplateDetails.vue'

function mountDetails(overrides = {}) {
  const preset = overrides.preset || {
    id: 1,
    preset_id: 1,
    name: 'Starter',
    customSignals: {
      keywords: {
        require_any: ['space opera'],
      },
      removed: {
        genres: {
          prefer: ['Comedy'],
        },
      },
    },
  }

  return mount(PolicyStarterTemplateDetails, {
    props: {
      preset,
      allPresets: overrides.allPresets || [{
        id: 1,
        signals: {
          certifications: {
            include: ['PG'],
          },
          genres: {
            prefer: ['Comedy'],
            exclude: ['Horror'],
          },
          keywords: {
            exclude: ['slasher'],
          },
          language: {
            require_any: ['sv'],
            strict: false,
          },
        },
      }],
      availableRatings: ['G', 'PG'],
      availableGenres: ['Comedy', 'Drama'],
    },
  })
}

describe('PolicyStarterTemplateDetails.vue', () => {
  it('renders base signals, custom signals, removed state, and language summary', () => {
    const wrapper = mountDetails()

    expect(wrapper.text()).toContain('Content Ratings:')
    expect(wrapper.text()).toContain('PG')
    expect(wrapper.text()).toContain('Comedy')
    expect(wrapper.text()).toContain('space opera')
    expect(wrapper.text()).toContain('Swedish')
    expect(wrapper.text()).toContain('Advisory presets only influence score')

    const removedGenre = wrapper.findAll('span').find(item => item.text().includes('Comedy'))
    expect(removedGenre.classes()).toContain('line-through')
  })

  it('emits bounded custom signal add and remove payloads', async () => {
    const wrapper = mountDetails()
    const selects = wrapper.findAll('select')

    await selects[0].setValue('include:PG')
    expect(wrapper.emitted('add-custom-signal')?.[0][0]).toMatchObject({
      signalType: 'certifications',
      key: 'include',
      value: 'PG',
    })

    await wrapper.find('input').setValue('  Space Opera  ')
    await wrapper.find('input').trigger('keydown.enter')
    expect(wrapper.emitted('add-custom-signal')?.[1][0]).toMatchObject({
      signalType: 'keywords',
      key: 'require_any',
      value: 'space opera',
    })

    const customKeywordRemove = wrapper.findAll('button')
      .find(button => button.text() === '×' && button.element.parentElement?.textContent?.includes('space opera'))
    await customKeywordRemove.trigger('click')

    expect(wrapper.emitted('remove-custom-signal')?.[0][0]).toMatchObject({
      signalType: 'keywords',
      key: 'require_any',
      value: 'space opera',
    })
  })

  it('emits base signal removal and strict-mode payloads', async () => {
    const wrapper = mountDetails()

    const restoreButton = wrapper.findAll('button').find(button => button.text() === '↩')
    await restoreButton.trigger('click')
    expect(wrapper.emitted('set-signal-removal')?.[0][0]).toMatchObject({
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: false,
    })

    const strictButton = wrapper.findAll('button').find(button => button.text() === 'Strict')
    await strictButton.trigger('click')
    expect(wrapper.emitted('set-signal-strict')?.[0][0]).toMatchObject({
      signalType: 'language',
      strict: true,
      baseStrict: false,
    })
  })
})
