/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { test, expect } from 'vitest'
import DailyProvenanceCoverage from '../components/stats/DailyProvenanceCoverage.vue'
import { dailyProvenanceFixture } from './helpers/dailyProvenanceFixture'

const render = (trend = dailyProvenanceFixture()) => mount(DailyProvenanceCoverage, { props: { trend } })

test('shows 14 native date rows, partial today, exact counts and N/A for empty dates', () => {
  const wrapper = render()
  expect(wrapper.find('caption').text()).toBe('Original method capture by stored history date')
  expect(wrapper.findAll('th[scope="col"]').map(cell => cell.text())).toEqual([
    'History date', 'Events', 'Captured', 'Unrecorded', 'Invalid', 'Unsupported', 'Capture coverage',
  ])
  expect(wrapper.findAll('tbody th[scope="row"]')).toHaveLength(14)
  expect(wrapper.findAll('time').map(time => time.attributes('datetime'))).toEqual(dailyProvenanceFixture().days.map(day => day.date))
  expect(wrapper.findAll('tbody tr')[0].findAll('td').map(cell => cell.text())).toEqual(['0', '0', '0', '0', '0', 'N/A'])
  expect(wrapper.findAll('tbody tr').at(-1).findAll('td').map(cell => cell.text())).toEqual(['4', '1', '1', '1', '1', '25.0%'])
  expect(wrapper.findAll('.partial')).toHaveLength(1)
  expect(wrapper.find('.partial').text()).toBe('Today (partial)')
  expect(wrapper.find('[role="region"]').attributes()).toMatchObject({ tabindex: '0', 'aria-label': 'Daily provenance coverage table' })
  expect(wrapper.text()).toContain('Database calendar: America/New_York')
  expect(wrapper.text()).toContain('not classifier accuracy')
  expect(wrapper.findAll('button, select, input')).toHaveLength(0)
})

test('shows exclusions separately and escapes calendar metadata', () => {
  const trend = dailyProvenanceFixture()
  trend.time_zone = '<img src=x onerror=alert(1)>'
  trend.excluded = { older_events: 20, future_events: 2, undated_events: 3 }
  const wrapper = render(trend)
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('20 older, 2 at or after the capture cutoff, 3 without a usable date')
  expect(wrapper.text()).toContain('4 events')
})

test.each([null, {}, { ...dailyProvenanceFixture(), days: [] },
  { ...dailyProvenanceFixture(), totals: { ...dailyProvenanceFixture().totals, captured_events: '1' } },
  { ...dailyProvenanceFixture(), totals: { ...dailyProvenanceFixture().totals, captured_events: 2 } },
])('missing or malformed trend does not invent zero', trend => {
  const wrapper = render(trend)
  expect(wrapper.find('[role="status"]').text()).toContain('Counts have not been estimated')
  expect(wrapper.find('table').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('NaN')
})

test('zero-event coverage stays unavailable while zero captured among events is 0%', () => {
  const zero = { events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 }
  expect(render(dailyProvenanceFixture(zero)).text()).toContain('(N/A)')
  expect(render(dailyProvenanceFixture({ ...zero, events: 2, unrecorded_events: 2 })).text()).toContain('(0.0%)')
})
