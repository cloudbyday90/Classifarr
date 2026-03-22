/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickAddPanel from '@/components/command-center/QuickAddPanel.vue'

function mountPanel(props = {}) {
  return mount(QuickAddPanel, {
    props: {
      expanded: true,
      query: '',
      results: [],
      selected: null,
      searching: false,
      submitting: false,
      errorMessage: '',
      successMessage: '',
      formatMediaType: (value) => (value === 'tv' ? 'TV' : 'Movie'),
      ...props,
    },
  })
}

describe('QuickAddPanel', () => {
  it('emits toggle when the section header is clicked', async () => {
    const wrapper = mountPanel()

    await wrapper.find('.secondary-section-header').trigger('click')

    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('emits query and search events from the form controls', async () => {
    const wrapper = mountPanel()

    const input = wrapper.find('input[placeholder="Search TMDB..."]')
    await input.setValue('Inception')
    await input.trigger('keyup.enter')
    await wrapper.findAll('button').find((node) => node.text() === 'Search').trigger('click')

    expect(wrapper.emitted('update:query')).toEqual([['Inception']])
    expect(wrapper.emitted('search')).toHaveLength(2)
  })

  it('renders selection state and emits submit/select-result actions', async () => {
    const selected = { id: 27205, media_type: 'movie', title: 'Inception', year: '2010' }
    const alt = { id: 157336, media_type: 'movie', title: 'Interstellar', year: '2014' }
    const wrapper = mountPanel({
      results: [selected, alt],
      selected,
    })

    expect(wrapper.text()).toContain('Selected: Inception')

    const resultButtons = wrapper.findAll('.quickadd-result')
    expect(resultButtons[0].classes()).toContain('quickadd-result-selected')
    expect(resultButtons[0].attributes('aria-pressed')).toBe('true')
    expect(resultButtons[1].attributes('aria-pressed')).toBe('false')

    await resultButtons[1].trigger('click')
    await wrapper.findAll('button').find((node) => node.text() === 'Add').trigger('click')

    expect(wrapper.emitted('select-result')).toEqual([[alt]])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('disables interactions and shows searching status while searching', () => {
    const wrapper = mountPanel({
      query: 'Inception',
      results: [{ id: 27205, media_type: 'movie', title: 'Inception', year: '2010' }],
      searching: true,
    })

    expect(wrapper.text()).toContain('Searching TMDB...')

    const input = wrapper.find('input[placeholder="Search TMDB..."]')
    expect(input.attributes('disabled')).toBeDefined()

    const resultButton = wrapper.find('.quickadd-result')
    expect(resultButton.attributes('disabled')).toBeDefined()

    const addButton = wrapper.findAll('button').find((node) => node.text() === 'Add')
    expect(addButton.attributes('disabled')).toBeDefined()
  })

  it('hides form content when the section is collapsed', () => {
    const wrapper = mountPanel({ expanded: false })

    expect(wrapper.find('.secondary-section-content').exists()).toBe(false)
    expect(wrapper.find('input[placeholder="Search TMDB..."]').exists()).toBe(false)
  })
})
