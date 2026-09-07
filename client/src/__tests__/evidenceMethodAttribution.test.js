/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import EvidenceMethodAttribution from '../components/stats/EvidenceMethodAttribution.vue'

const fixture = () => ({ totals: { events: 5, captured_events: 2, unrecorded_events: 1, invalid_events: 1, unsupported_events: 1 },
  group_count: 5, truncated: false, groups: [
    { original_method: 'policy_auto', candidate_source: 'policy_ranked', provenance_status: 'captured' },
    { original_method: 'ai_analysis', candidate_source: null, provenance_status: 'captured' },
    ...['unrecorded', 'invalid', 'unsupported'].map(provenance_status => ({ original_method: null, candidate_source: null, provenance_status })),
  ].map(row => ({ ...row, recorded_method: 'manual_classification', events: 1, library_id: 1,
    library_name: '<img src=x onerror=alert(1)>', library_active: false })) })
const render = (attribution = fixture(), historyEvents = 5) => mount(EvidenceMethodAttribution, { props: { attribution, historyEvents } })

test('distinguishes original/current methods and known missing provenance with native table semantics', () => {
  const wrapper = render()
  expect(wrapper.find('caption').text()).toBe('Retained history by original and recorded method')
  expect(wrapper.findAll('th[scope="col"]').map(cell => cell.text())).toEqual([
    'Recorded library', 'Original method', 'Candidate source', 'Recorded method', 'History events',
  ])
  expect(wrapper.findAll('th[scope="row"]')).toHaveLength(5)
  expect(wrapper.find('[role="region"]').attributes()).toMatchObject({ tabindex: '0', 'aria-label': 'Original method attribution table' })
  expect(wrapper.findAll('tbody tr')[0].findAll('td').map(cell => cell.text())).toEqual(['policy auto', 'Policy ranking', 'manual classification', '1'])
  expect(wrapper.text()).toContain('No candidate source')
  expect(wrapper.text()).toContain('Original method captured for 2 of 5 history events; 1 unrecorded, 1 invalid, 1 unsupported')
  expect(wrapper.text()).toContain('Invalid provenance')
  expect(wrapper.text()).toContain('Unsupported method')
  expect(wrapper.text()).toContain('another view of the same history events')
  expect(wrapper.findAll('button, input, select, img')).toHaveLength(0)
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)> (inactive)')
})

test.each([null, {}, { totals: {} }, { ...fixture(), totals: { ...fixture().totals, captured_events: '2' } },
  { ...fixture(), totals: { ...fixture().totals, captured_events: 3 } }])('missing or inconsistent payload does not show zero counts', data => {
  const wrapper = render(data)
  expect(wrapper.find('[role="status"]').text()).toContain('Counts have not been estimated')
  expect(wrapper.find('table').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('NaN')
})

test('retained population mismatch is unavailable; an empty known population stays zero', () => {
  expect(render(fixture(), 6).find('table').exists()).toBe(false)
  const wrapper = render({ totals: { events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 },
    groups: [], group_count: 0, truncated: false }, 0)
  expect(wrapper.text()).toContain('captured for 0 of 0 history events')
  expect(wrapper.text()).toContain('No retained classification history')
})

test('discloses capped groups with uncapped totals', () => {
  const data = fixture()
  data.groups = data.groups.slice(0, 1)
  data.truncated = true
  const wrapper = render(data)
  expect(wrapper.text()).toContain('Showing 1 of 5 attribution groups. Totals include all groups.')
  expect(wrapper.text()).toContain('captured for 2 of 5 history events')
})
