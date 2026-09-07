/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { test, expect } from 'vitest'
import OriginalObservationTypes from '../components/stats/OriginalObservationTypes.vue'
import { utcProvenanceFixture } from './helpers/dailyProvenanceFixture'
import { libraryUtcCoverageFixture } from './helpers/libraryUtcCoverageFixture'

const fixture = () => {
  const trend = utcProvenanceFixture({ events: 10, captured_events: 6, unrecorded_events: 2, invalid_events: 1, unsupported_events: 1 }, 5)
  const coverage = libraryUtcCoverageFixture(trend, [{ retained_events: 15, ...trend.totals, ...trend.excluded,
    library_id: 1, library_name: '<img src=x onerror=alert(1)>', library_active: false }])
  const types = { imported_membership_events: 3, manual_action_events: 2, classifier_workflow_events: 1, unknown_origin_events: 4 }
  coverage.totals.observation_types = { ...types }
  coverage.groups[0].observation_types = { ...types }
  return { trend, coverage, historyEvents: 15 }
}
const render = props => mount(OriginalObservationTypes, { props: props ?? fixture() })
test('presents scoped type composition with native semantics and escaped names without per-type rates', () => {
  const wrapper = render()
  expect(wrapper.find('caption').text()).toBe('Original observation types within the library UTC window')
  expect(wrapper.findAll('thead th[scope="col"]')).toHaveLength(6)
  expect(wrapper.find('tbody th[scope="row"]').text()).toContain('<img src=x onerror=alert(1)> (inactive)')
  expect(wrapper.findAll('tbody td').map(cell => cell.text())).toEqual(['10', '3', '2', '1', '4'])
  expect(wrapper.findAll('tfoot td').map(cell => cell.text())).toEqual(['10', '3', '2', '1', '4'])
  expect(wrapper.find('[role="region"]').attributes('tabindex')).toBe('0')
  expect(wrapper.text()).toContain('Unknown recording times, older events and future events are excluded')
  expect(wrapper.text()).toContain('not an independent review label')
  expect(wrapper.findAll('button,select,input,img')).toHaveLength(0)
  expect(wrapper.text()).not.toContain('%')
})
test.each(['missing', 'field', 'negative', 'fraction', 'unsafe', 'partition', 'uncaptured', 'global'])('rejects inconsistent %s types', kind => {
  const props = fixture()
  const row = props.coverage.groups[0].observation_types
  if (kind === 'missing') delete props.coverage.totals.observation_types
  if (kind === 'field') delete row.manual_action_events
  if (kind === 'negative') row.manual_action_events = -1
  if (kind === 'fraction') row.manual_action_events = 0.5
  if (kind === 'unsafe') row.manual_action_events = Number.MAX_SAFE_INTEGER + 1
  if (kind === 'partition') row.unknown_origin_events = 3
  if (kind === 'uncaptured') Object.assign(row, { manual_action_events: 3, unknown_origin_events: 3 })
  if (kind === 'global') Object.assign(row, { manual_action_events: 3, imported_membership_events: 2 })
  const wrapper = render(props)
  expect(wrapper.find('table').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').text()).toContain('Counts have not been estimated')
})
test('capped library rows retain all-library type totals and reject hidden per-type excess', () => {
  const trend = utcProvenanceFixture({ events: 201, captured_events: 201, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 })
  const groups = Array.from({ length: 200 }, (_, i) => ({ retained_events: 1, events: 1, captured_events: 1,
    unrecorded_events: 0, invalid_events: 0, unsupported_events: 0, older_events: 0, future_events: 0, unknown_events: 0,
    capture_coverage: 1, library_id: i + 1, library_name: 'Library', library_active: true }))
  const coverage = { ...libraryUtcCoverageFixture(trend, groups), group_count: 201, truncated: true }
  const props = { trend, coverage, historyEvents: 201 }
  const wrapper = render(props)
  expect(wrapper.findAll('tbody tr')).toHaveLength(200)
  expect(wrapper.find('tfoot').text()).toContain('201')
  expect(wrapper.find('[role="status"]').text()).toContain('All-library totals include the omitted groups')
  Object.assign(coverage.groups[0].observation_types, { classifier_workflow_events: 0, manual_action_events: 1 })
  expect(render(props).find('table').exists()).toBe(false)
})
