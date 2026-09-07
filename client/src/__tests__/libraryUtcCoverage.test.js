/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { test, expect } from 'vitest'
import LibraryUtcCoverage from '../components/stats/LibraryUtcCoverage.vue'
import { utcProvenanceFixture } from './helpers/dailyProvenanceFixture'
import { libraryUtcCoverageFixture } from './helpers/libraryUtcCoverageFixture'

const fixture = () => {
  const trend = utcProvenanceFixture(undefined, 6)
  const groups = [
    { retained_events: 4, ...trend.totals, older_events: 0, future_events: 0, unknown_events: 0,
      library_id: 1, library_name: '<img src=x onerror=alert(1)>', library_active: false },
    { retained_events: 6, events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0,
      older_events: 0, future_events: 0, unknown_events: 6, capture_coverage: null, library_id: null, library_name: null, library_active: null },
  ]
  return { coverage: libraryUtcCoverageFixture(trend, groups), trend, historyEvents: 10 }
}
const render = props => mount(LibraryUtcCoverage, { props: props ?? fixture() })

test('shows distinct library/time counts with native headers, escaped names and no controls', () => {
  const wrapper = render()
  expect(wrapper.find('caption').text()).toBe('UTC provenance window and time exclusions by recorded library')
  expect(wrapper.findAll('th[scope="col"]')).toHaveLength(11)
  expect(wrapper.findAll('th[scope="row"]')).toHaveLength(2)
  expect(wrapper.find('[role="region"]').attributes()).toMatchObject({ tabindex: '0', 'aria-label': 'UTC library capture table' })
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)> (inactive)')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('Unassigned or removed library')
  expect(wrapper.text()).toContain('6 have an unknown recording time')
  expect(wrapper.text()).toContain('N/A')
  expect(wrapper.text()).toContain('25.0%')
  expect(wrapper.text()).toContain('do not establish current inventory membership or classification accuracy')
  expect(wrapper.findAll('button, select, input')).toHaveLength(0)
})

test.each(['missing', 'basis', 'dates', 'size', 'partition', 'global', 'unknown', 'duplicate', 'name', 'null_label', 'fraction', 'group_count'])('rejects malformed %s without inventing counts', kind => {
  const props = fixture()
  if (kind === 'missing') props.coverage = null
  if (kind === 'basis') props.coverage.timestamp_basis = 'stored_database_calendar'
  if (kind === 'dates') props.coverage.end_date = '2026-09-08'
  if (kind === 'size') props.coverage.group_limit = 201
  if (kind === 'partition') props.coverage.groups[0].captured_events = 2
  if (kind === 'global') props.historyEvents = 11
  if (kind === 'unknown') Object.assign(props.coverage.totals, { unknown_events: 5, older_events: 1 })
  if (kind === 'duplicate') props.coverage.groups[1].library_id = 1
  if (kind === 'name') props.coverage.groups[0].library_name = 'x'.repeat(256)
  if (kind === 'null_label') props.coverage.groups[1].library_name = 'Invented'
  if (kind === 'fraction') props.coverage.groups[0].capture_coverage = 1
  if (kind === 'group_count') props.coverage.group_count = 11
  const wrapper = render(props)
  expect(wrapper.find('table').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').text()).toContain('Counts have not been estimated')
  expect(wrapper.text()).not.toContain('NaN')
})

test('capped rows disclose omissions and retain global totals', () => {
  const trend = utcProvenanceFixture({ events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 }, 201)
  const groups = Array.from({ length: 200 }, (_, i) => ({ retained_events: 1, ...trend.totals, ...trend.excluded,
    unknown_events: 1, library_id: i + 1, library_name: 'Library', library_active: true }))
  const coverage = { ...libraryUtcCoverageFixture(trend, groups), group_count: 201, truncated: true }
  const wrapper = render({ coverage, trend, historyEvents: 201 })
  expect(wrapper.find('[role="status"]').text()).toContain('Showing 200 of 201 recorded-library groups')
  expect(wrapper.text()).toContain('201 have an unknown recording time')
  expect(wrapper.findAll('tbody tr')).toHaveLength(200)
  Object.assign(coverage.groups[0], { retained_events: 2, unknown_events: 2 })
  expect(render({ coverage, trend, historyEvents: 201 }).find('table').exists()).toBe(false)
})

test('empty retained history shows an empty table instead of rows for unmeasured libraries', () => {
  const trend = utcProvenanceFixture({ events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 })
  const wrapper = render({ trend, coverage: libraryUtcCoverageFixture(trend, []), historyEvents: 0 })
  expect(wrapper.text()).toContain('No retained classification history.')
  expect(wrapper.findAll('tbody th')).toHaveLength(0)
})
