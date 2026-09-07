/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyStatsComparison from '../components/stats/PolicyStatsComparison.vue'

test('updates a semantic comparison table when a missing period becomes available', async () => {
  const current = { period: 'last_7_days', decisions: '0', accuracy: null, auto_rate: '0' }
  const wrapper = mount(PolicyStatsComparison, { props: { periods: [current] } })
  expect(wrapper.findAll('th[scope="col"]')).toHaveLength(4)
  expect(wrapper.findAll('th[scope="row"]')).toHaveLength(3)
  expect(wrapper.find('caption').text()).toContain('last 7 days and previous 7 days')
  const scrollRegion = wrapper.find('[role="region"]')
  expect(scrollRegion.attributes('tabindex')).toBe('0')
  expect(wrapper.find('p').attributes('id')).toBe(scrollRegion.attributes('aria-describedby'))
  expect(wrapper.findAll('tbody tr')[2].findAll('td').map(cell => cell.text())).toEqual(['0.0%', 'N/A', 'N/A'])
  await wrapper.setProps({ periods: [current, { period: 'previous_7_days', decisions: '2', accuracy: 0.5, auto_rate: 50 }] })
  expect(wrapper.findAll('tbody tr')[2].findAll('td').map(cell => cell.text())).toEqual(['0.0%', '50.0%', '-50.0 percentage points'])
  expect(wrapper.findAll('tbody tr')[1].findAll('td').map(cell => cell.text())).toEqual(['N/A', '50.0%', 'N/A'])
  wrapper.unmount()
})
