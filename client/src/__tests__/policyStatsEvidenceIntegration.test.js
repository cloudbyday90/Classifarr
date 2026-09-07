/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { shallowMount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import PolicyStatsDashboard from '../views/PolicyStatsDashboard.vue'
import EvidenceCoverageBreakdown from '../components/stats/EvidenceCoverageBreakdown.vue'
import api from '../api'

vi.mock('../api', () => ({ default: { getPolicyStatsOverview: vi.fn(), getPolicyStatsList: vi.fn(),
  getPolicyStatsLiveFeed: vi.fn(), getPolicyStatsAlerts: vi.fn() } }))
let wrapper
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  api.getPolicyStatsOverview.mockResolvedValue({ evidence_coverage: { status: 'unavailable' } })
  api.getPolicyStatsList.mockResolvedValue([])
  api.getPolicyStatsLiveFeed.mockResolvedValue([])
  api.getPolicyStatsAlerts.mockResolvedValue([])
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); vi.useRealTimers() })

test('existing overview loading automatically feeds the evidence component', async () => {
  wrapper = shallowMount(PolicyStatsDashboard)
  await flushPromises()
  expect(api.getPolicyStatsOverview).toHaveBeenCalledTimes(1)
  expect(wrapper.findComponent(EvidenceCoverageBreakdown).props('coverage')).toEqual({ status: 'unavailable' })
})

test('leaving the dashboard removes its visibility listener and prevents new background reads', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  wrapper = shallowMount(PolicyStatsDashboard)
  await flushPromises()
  visibility.mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  wrapper.unmount()
  wrapper = null
  visibility.mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(60000)
  expect(api.getPolicyStatsOverview).toHaveBeenCalledTimes(1)
})
