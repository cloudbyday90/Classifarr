/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { test, expect } from 'vitest'
import HistoryRecordingTimeCoverage from '../components/stats/HistoryRecordingTimeCoverage.vue'

const render = (coverage, historyEvents = 5) => mount(HistoryRecordingTimeCoverage, { props: { coverage, historyEvents } })

test('explains known and unknown instants without requiring operator input', () => {
  const wrapper = render({ events: 5, recorded_events: 2, unknown_events: 3 })
  expect(wrapper.attributes('aria-label')).toBe('History recording times')
  expect(wrapper.text()).toContain('2 of 5 retained history events have a known recording time. 3 have an unknown recording time.')
  expect(wrapper.text()).toContain('UTC view uses known recording times; the calendar view keeps older stored dates')
  expect(wrapper.text()).toContain('does not measure classification accuracy')
  expect(wrapper.findAll('button, input, select, a')).toHaveLength(0)
})

test('empty retained history is known zero', () => {
  const wrapper = render({ events: 0, recorded_events: 0, unknown_events: 0 }, 0)
  expect(wrapper.text()).toContain('0 of 0 retained history events')
  expect(wrapper.text()).not.toContain('unavailable')
})

test.each([null, undefined, {}, { events: 5, recorded_events: 1, unknown_events: 3 },
  { events: 5, recorded_events: -1, unknown_events: 6 }, { events: 5, recorded_events: '2', unknown_events: 3 },
  { events: 4, recorded_events: 1, unknown_events: 3 }])('missing or inconsistent counts are unavailable: %j', value => {
  const wrapper = render(value)
  expect(wrapper.text()).toContain('Recording-time coverage is unavailable.')
  expect(wrapper.text()).not.toMatch(/NaN|0 of 0/)
})
