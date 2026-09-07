/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import EvidenceCoverageBreakdown from '../components/stats/EvidenceCoverageBreakdown.vue'

const snapshot = () => ({ status: 'available', captured_at: '2026-09-07T00:00:00Z',
  history: { totals: { events: 3 }, groups: [{ library_id: 1, library_name: '<img src=x onerror=alert(1)>', library_active: false,
    method: 'source_library', events: 3, imported_observations: 3, original_candidates: 0, linked_feedback: 0 }], group_count: 1, truncated: false },
  feedback: { totals: { observations: 0, evaluated: 0, evaluation_coverage: null }, groups: [], group_count: 0, truncated: false },
  deleted_feedback_receipts: 0 })
const render = coverage => mount(EvidenceCoverageBreakdown, { props: { coverage }, global: { stubs: { RouterLink: true } } })

test('uses separately captioned tables with native column/row headers and keyboard overflow', () => {
  const wrapper = render(snapshot())
  expect(wrapper.findAll('table')).toHaveLength(2)
  expect(wrapper.findAll('caption').map(caption => caption.text())).toEqual([
    'Retained history by recorded library and method', 'Retained feedback by selected library and source method',
  ])
  expect(wrapper.findAll('th[scope="col"]')).toHaveLength(10)
  expect(wrapper.find('th[scope="row"]').text()).toContain('Imported membership')
  expect(wrapper.findAll('[role="region"][tabindex="0"]')).toHaveLength(2)
  expect(wrapper.find('time').attributes('datetime')).toBe('2026-09-07T00:00:00Z')
  expect(wrapper.findComponent({ name: 'RouterLink' }).attributes('to')).toBe('/libraries')
  expect(wrapper.text()).toContain('These populations cannot be added together')
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
