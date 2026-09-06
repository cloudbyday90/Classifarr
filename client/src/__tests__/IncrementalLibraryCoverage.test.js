/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryObservationHistory from '@/components/library/LibraryObservationHistory.vue'
import { getLibraryObservationHistory } from '@/api/libraryCatalogApi'
import { incrementalLibraryCoverageFixture } from './fixtures/incrementalLibraryCoverageFixture'
import { observationScanRestart } from '@/utils/observationScanDisplay'
vi.mock('@/api/libraryCatalogApi', () => ({ getLibraryObservationHistory: vi.fn() }))

it('loads complete, partial and invalidated scans with explicit times and unknown counts', async () => {
  getLibraryObservationHistory.mockResolvedValue(incrementalLibraryCoverageFixture())
  const wrapper = mount(LibraryObservationHistory)
  await flushPromises()
  expect(wrapper.text()).toContain('20000 rows scanned; more remain')
  expect(wrapper.text()).toContain('Complete coverage measured as of')
  expect(wrapper.text()).toContain('Freshness uses that time')
  expect(wrapper.text()).toContain('Inputs changed before this visit could be saved')
  expect(wrapper.text()).toContain('inventory or observed metadata changed')
  const details = wrapper.findAll('details')
  for (const detail of details.slice(0, 3)) { detail.element.open = true; await detail.trigger('toggle') }
  expect(wrapper.findAll('td[colspan="5"]').map(cell => cell.text())).toEqual([
    '20000 rows scanned; complete counts unavailable.', 'Page discarded after inputs changed; counts unavailable.',
  ])
  expect(wrapper.text()).toContain('20001 / 20001')
  expect(getLibraryObservationHistory).toHaveBeenCalledTimes(1)
})
it.each(['observation_clocks_changed', 'sampling_gap', 'configuration_changed', 'expired', 'clock_anomaly', 'unknown'])('explains scan restart %s without exposing internals', reason => {
  expect(observationScanRestart(reason)).toContain('scan restarted')
})
