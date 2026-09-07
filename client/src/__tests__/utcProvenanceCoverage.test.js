/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { test, expect } from 'vitest'
import UtcProvenanceCoverage from '../components/stats/UtcProvenanceCoverage.vue'
import DailyProvenanceCoverage from '../components/stats/DailyProvenanceCoverage.vue'
import { dailyProvenanceFixture, utcProvenanceFixture } from './helpers/dailyProvenanceFixture'

const render = trend => mount(UtcProvenanceCoverage, { props: { trend } })
test('shows the UTC basis, known-time denominator and distinct unknown-time exclusions', () => {
  const trend = utcProvenanceFixture(undefined, 100)
  const wrapper = render(trend)
  expect(wrapper.find('caption').text()).toBe('Original method capture by UTC recording date')
  expect(wrapper.find('[role="region"]').attributes()).toMatchObject({ tabindex: '0', 'aria-label': 'UTC provenance coverage table' })
  expect(wrapper.findAll('th[scope="col"]')).toHaveLength(7)
  expect(wrapper.findAll('th[scope="row"]')).toHaveLength(14)
  expect(wrapper.findAll('time').map(time => time.attributes('datetime'))).toEqual(trend.days.map(day => day.date))
  expect(wrapper.text()).toContain('1 of 4 events with known recording times')
  expect(wrapper.text()).toContain('100 with an unknown recording time')
  expect(wrapper.text()).toContain('Do not add this view to the calendar view')
  expect(wrapper.text()).toContain('not classifier accuracy')
  expect(wrapper.findAll('.partial')).toHaveLength(1)
  expect(wrapper.findAll('input, button, select')).toHaveLength(0)
})

test('empty or entirely unknown history has N/A coverage and zero dated events', () => {
  const trend = utcProvenanceFixture({ events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 }, 100)
  expect(render(trend).text()).toContain('(N/A)')
  expect(render(trend).text()).toContain('100 with an unknown recording time')
})

test('calendar data cannot impersonate the UTC view', () => {
  expect(render(dailyProvenanceFixture()).find('table').exists()).toBe(false)
  expect(render({ ...utcProvenanceFixture(), time_zone: 'America/New_York' }).find('table').exists()).toBe(false)
})

test.each(['missing', 'date', 'partial', 'order', 'fraction', 'negative', 'exclusion', 'reconciliation'])('both views safely reject malformed %s', kind => {
  for (const [component, trend] of [[UtcProvenanceCoverage, utcProvenanceFixture()], [DailyProvenanceCoverage, dailyProvenanceFixture()]]) {
    if (kind === 'missing') trend.days = null
    if (kind === 'date') trend.start_date = '2026-02-30'
    if (kind === 'partial') trend.days[13].is_partial = false
    if (kind === 'order') trend.days.reverse()
    if (kind === 'fraction') trend.totals.capture_coverage = 0.99
    if (kind === 'negative') trend.totals.events = -1
    if (kind === 'exclusion') trend.excluded.older_events = '<img src=x onerror=alert(1)>'
    if (kind === 'reconciliation') Object.assign(trend.days[0], { events: 1, captured_events: 1, capture_coverage: 1 })
    const wrapper = mount(component, { props: { trend } })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toContain('Counts have not been estimated')
    expect(wrapper.text()).not.toContain('NaN')
  }
})
