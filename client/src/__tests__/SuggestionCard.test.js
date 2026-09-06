/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import SuggestionCard from '../components/suggestions/SuggestionCard.vue'

test.each(['superseded', 'unknown', null])('historical status %s is not represented as a human rejection', status => {
  const wrapper = shallowMount(SuggestionCard, { props: { suggestion: {
    id: 1, status, suggestion_type: 'create_pattern', suggestion_config: {},
    superseded_at: '2026-08-01T00:00:00Z',
  } } })
  expect(wrapper.text()).toContain(status === 'superseded' ? 'Superseded after evidence changed' : 'Review unavailable')
  expect(wrapper.text()).not.toContain('Rejected:')
  expect(wrapper.find('.btn-success').exists()).toBe(false)
  wrapper.unmount()
})
