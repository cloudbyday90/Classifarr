/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import EvidenceCoverageBreakdown from '../components/stats/EvidenceCoverageBreakdown.vue'

const snapshot = () => ({ status: 'available', captured_at: '2026-09-07T00:00:00Z',
  history: { totals: { events: 3, completed_events: 2, pending_events: 1, retry_events: 0, other_events: 0,
    original_candidates: 0, candidate_no_proposal: 0, candidate_invalid: 0, candidate_not_applicable: 3, candidate_unrecorded: 0 }, groups: [{ library_id: 1, library_name: '<img src=x onerror=alert(1)>', library_active: false,
    method: 'source_library', events: 3, completed_events: 2, pending_events: 1, retry_events: 0, other_events: 0,
    imported_observations: 3, original_candidates: 0, linked_feedback: 0,
    candidate_no_proposal: 0, candidate_invalid: 0, candidate_not_applicable: 3, candidate_unrecorded: 0 }], group_count: 1, truncated: false },
  feedback: { totals: { observations: 0, evaluated: 0, evaluation_coverage: null }, groups: [], group_count: 0, truncated: false },
  deleted_feedback_receipts: 0 })
const render = coverage => mount(EvidenceCoverageBreakdown, { props: { coverage }, global: { stubs: { RouterLink: true } } })

test('uses separately captioned tables with native column/row headers and keyboard overflow', () => {
  const wrapper = render(snapshot())
  expect(wrapper.findAll('table')).toHaveLength(2)
  expect(wrapper.findAll('caption').map(caption => caption.text())).toEqual([
    'Retained history by recorded library and method', 'Retained feedback by selected library and recorded source method',
  ])
  expect(wrapper.findAll('th[scope="col"]')).toHaveLength(10)
  expect(wrapper.find('th[scope="row"]').text()).toContain('Imported membership')
  expect(wrapper.findAll('[role="region"][tabindex="0"]')).toHaveLength(2)
  expect(wrapper.find('time').attributes('datetime')).toBe('2026-09-07T00:00:00Z')
  expect(wrapper.findComponent({ name: 'RouterLink' }).attributes('to')).toBe('/libraries')
  expect(wrapper.text()).toContain('These populations cannot be added together')
  expect(wrapper.text()).toContain('Original method attribution is unavailable')
  expect(wrapper.text()).toContain('Daily provenance coverage is unavailable')
});

test('automatically displays labelled lifecycle totals and group counts without controls', () => {
  const wrapper = render(snapshot())
  expect(wrapper.findAll('.lifecycle-counts')).toHaveLength(2)
  for (const list of wrapper.findAll('.lifecycle-counts')) {
    expect(list.findAll('dt').map(term => term.text())).toEqual(['Completed', 'Pending decision', 'Retry pending', 'Other'])
    expect(list.findAll('dd').map(count => count.text())).toEqual(['2', '1', '0', '0'])
  }
  expect(wrapper.findAll('button, input, select')).toHaveLength(0)
  expect(wrapper.text()).toContain('does not mean correct or reviewed')
  expect(wrapper.text()).toContain('not live queue depth')
});

test.each([undefined, null, -1, 1.5, '2', 4])('missing or inconsistent lifecycle %s does not appear as zero', invalid => {
  const data = snapshot()
  data.history.totals.completed_events = invalid
  data.history.groups[0].completed_events = invalid
  const wrapper = render(data)
  expect(wrapper.findAll('.lifecycle-counts')).toHaveLength(0)
  expect(wrapper.findAll('.unavailable')).toHaveLength(2)
  expect(wrapper.text()).toContain('History lifecycle is unavailable')
  expect(wrapper.text()).toContain('3 history events')
  expect(wrapper.text()).not.toContain('NaN')
});

test('shows bounded candidate missing reasons automatically and distinguishes zero from unavailable', () => {
  const data = snapshot()
  const wrapper = render(data)
  expect(wrapper.findAll('.capture-counts')).toHaveLength(2)
  expect(wrapper.find('.capture-counts dt').text()).toBe('Not applicable')
  expect(wrapper.find('.capture-counts dd').text()).toBe('3')
  expect(wrapper.text()).toContain('0 original candidates recorded')
  expect(wrapper.text()).toContain('Only nonzero missing-reason counts are shown')
  delete data.history.totals.candidate_not_applicable
  delete data.history.groups[0].candidate_not_applicable
  const legacy = render(data)
  expect(legacy.findAll('.capture-counts')).toHaveLength(0)
  expect(legacy.findAll('.capture-unavailable')).toHaveLength(2)
  expect(legacy.text()).not.toContain('NaN')
});

test('escapes library names and preserves inactive and empty-population labels', () => {
  const wrapper = render(snapshot())
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)> (inactive)')
  expect(wrapper.text()).toContain('No retained feedback observations')
  expect(wrapper.text()).toContain('N/A of feedback')
});

test.each([null, { status: 'unavailable', history: null }])('unavailable data is not rendered as zero', coverage => {
  const wrapper = render(coverage)
  expect(wrapper.find('[role="status"]').text()).toContain('Counts have not been estimated')
  expect(wrapper.find('table').exists()).toBe(false)
});

test('shows truncated groups, unknown attribution, zero evaluated coverage and deleted receipts explicitly', () => {
  const data = snapshot()
  data.history.truncated = true
  data.history.group_count = 201
  data.history.groups[0].library_id = null
  data.feedback = { totals: { observations: 1, evaluated: 0, evaluation_coverage: 0 }, truncated: true, group_count: 201,
    groups: [{ library_id: null, method: 'source_history_removed', observations: 1, source_bound: 1, evaluated: 0, evaluation_coverage: 0 }] }
  data.deleted_feedback_receipts = 2
  const wrapper = render(data)
  expect(wrapper.text()).toContain('Showing 1 of 201 history groups')
  expect(wrapper.text()).toContain('Showing 1 of 201 feedback groups')
  expect(wrapper.text()).toContain('Unassigned or removed library')
  expect(wrapper.text()).toContain('Source history removed')
  expect(wrapper.text()).toContain('0.0%')
  expect(wrapper.text()).toContain('2 deleted feedback results')
});
