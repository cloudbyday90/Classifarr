/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { test, expect } from 'vitest'
import CandidateLibraryComparison from '../components/stats/CandidateLibraryComparison.vue'
import { isLibraryUtcCoverage } from '../utils/libraryUtcCoverageDisplay'
import { utcProvenanceFixture } from './helpers/dailyProvenanceFixture'
import { libraryUtcCoverageFixture } from './helpers/libraryUtcCoverageFixture'

const fixture = () => {
  const trend = utcProvenanceFixture({ events: 11, captured_events: 6, unrecorded_events: 3, invalid_events: 1, unsupported_events: 1 }, 5)
  const comparison = { same_library_events: 2, different_library_events: 1, no_candidate_events: 1, invalid_candidate_events: 1, unknown_library_events: 0 }
  const unknown = { same_library_events: 0, different_library_events: 0, no_candidate_events: 0, invalid_candidate_events: 0, unknown_library_events: 1 }
  const coverage = libraryUtcCoverageFixture(trend, [
    { retained_events: 15, events: 10, captured_events: 5, unrecorded_events: 3, invalid_events: 1, unsupported_events: 1,
      ...trend.excluded, capture_coverage: 0.5, library_id: 1, library_name: '<img src=x onerror=alert(1)>', library_active: false,
      candidate_comparison: comparison },
    { retained_events: 1, events: 1, captured_events: 1, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0,
      older_events: 0, future_events: 0, unknown_events: 0, capture_coverage: 1,
      library_id: null, library_name: null, library_active: null, candidate_comparison: unknown },
  ])
  coverage.totals.candidate_comparison = { ...comparison, unknown_library_events: 1 }
  return { trend, coverage, historyEvents: 16 }
}
const render = props => mount(CandidateLibraryComparison, { props: props ?? fixture() })
test('presents five exclusive outcomes with scoped headers, escaped names and explicit comparison limits', () => {
  const wrapper = render()
  expect(wrapper.find('caption').text()).toBe('Original candidate comparison within the library UTC window')
  expect(wrapper.findAll('thead th[scope="col"]')).toHaveLength(7)
  expect(wrapper.findAll('tbody th[scope="row"]')).toHaveLength(2)
  expect(wrapper.find('tbody th').text()).toContain('<img src=x onerror=alert(1)> (inactive)')
  expect(wrapper.findAll('tbody tr')[0].findAll('td').map(cell => cell.text())).toEqual(['5', '2', '1', '1', '1', '0'])
  expect(wrapper.findAll('tfoot td').map(cell => cell.text())).toEqual(['6', '2', '1', '1', '1', '1'])
  expect(wrapper.find('[role="region"]').attributes('tabindex')).toBe('0')
  expect(wrapper.text()).toContain('later resolution or removal can change it')
  expect(wrapper.text()).toContain('not classification accuracy')
  expect(wrapper.text()).toContain('Missing original provenance is excluded')
  expect(wrapper.findAll('button,select,input,img')).toHaveLength(0)
  expect(wrapper.text()).not.toContain('%')
})
test.each(['missing', 'field', 'negative', 'fraction', 'string', 'unsafe', 'partition', 'global', 'known_as_unknown', 'unknown_as_known'])('rejects inconsistent %s comparison', kind => {
  const props = fixture()
  const counts = props.coverage.groups[0].candidate_comparison
  if (kind === 'missing') delete props.coverage.totals.candidate_comparison
  if (kind === 'field') delete counts.same_library_events
  if (kind === 'negative') counts.same_library_events = -1
  if (kind === 'fraction') counts.same_library_events = 0.5
  if (kind === 'string') counts.same_library_events = '2'
  if (kind === 'unsafe') counts.same_library_events = Number.MAX_SAFE_INTEGER + 1
  if (kind === 'partition') counts.same_library_events = 3
  if (kind === 'global') Object.assign(counts, { same_library_events: 1, different_library_events: 2 })
  if (kind === 'known_as_unknown') Object.assign(counts, { same_library_events: 1, unknown_library_events: 1 })
  if (kind === 'unknown_as_known') Object.assign(props.coverage.groups[1].candidate_comparison, { unknown_library_events: 0, same_library_events: 1 })
  expect(isLibraryUtcCoverage(props.coverage, props.trend, props.historyEvents)).toBe(true)
  const wrapper = render(props)
  expect(wrapper.find('table').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').text()).toContain('Counts have not been estimated')
})
test('empty retained history reports known zero without implying perfect agreement', () => {
  const trend = utcProvenanceFixture({ events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 })
  const wrapper = render({ trend, coverage: libraryUtcCoverageFixture(trend, []), historyEvents: 0 })
  expect(wrapper.find('tbody td').attributes('colspan')).toBe('7')
  expect(wrapper.findAll('tfoot td').map(cell => cell.text())).toEqual(['0', '0', '0', '0', '0', '0'])
  expect(wrapper.text()).toContain('No captured classifier workflows in this UTC window')
})
test('capped rows retain omitted comparison totals and reject hidden excess', () => {
  const trend = utcProvenanceFixture({ events: 201, captured_events: 201, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 })
  const groups = Array.from({ length: 200 }, (_, i) => ({ retained_events: 1, events: 1, captured_events: 1,
    unrecorded_events: 0, invalid_events: 0, unsupported_events: 0, older_events: 0, future_events: 0, unknown_events: 0,
    capture_coverage: 1, library_id: i + 1, library_name: 'Library', library_active: true }))
  const coverage = { ...libraryUtcCoverageFixture(trend, groups), group_count: 201, truncated: true }
  Object.assign(coverage.totals.candidate_comparison, { no_candidate_events: 200, different_library_events: 1 })
  const props = { trend, coverage, historyEvents: 201 }
  const wrapper = render(props)
  expect(wrapper.findAll('tbody tr')).toHaveLength(200)
  expect(wrapper.findAll('tfoot td').map(cell => cell.text())).toEqual(['201', '0', '1', '200', '0', '0'])
  expect(wrapper.find('[role="status"]').text()).toContain('All-library totals include the omitted groups')
  Object.assign(coverage.groups[0].candidate_comparison, { no_candidate_events: 0, same_library_events: 1 })
  expect(render(props).find('table').exists()).toBe(false)
})
