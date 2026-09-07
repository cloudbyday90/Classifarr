/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibrarySourceObservations from '@/components/library/LibrarySourceObservations.vue'
import { getLibrarySourceObservations } from '@/api/libraryCatalogApi'
vi.mock('@/api/libraryCatalogApi', () => ({ getLibrarySourceObservations: vi.fn() }))
const fixture = (status = 'complete') => ({ observedAt: '2026-09-07T20:00:00Z',
  scope: { selectedLibraryCount: 1, activeLibraryCount: 2, retentionDays: 30, retainedPerLibrary: 20000, previewPerLibrary: 5 },
  libraries: [{ id: 1, name: 'Movies', status, retainedCount: 1,
    capture: { startedAt: '2026-09-07T19:00:00Z', observedCount: 10, rejectedCount: 1, uncapturableCount: 0, omittedCount: 0 },
    examples: [{ sourceFingerprint: 'fixture', title: '<img src=x onerror=alert(1)>', year: 2020, mediaType: 'movie',
      identityIssue: 'conflicting_provider_ids', providerFields: ['tmdb_id'], lastSeenAt: '2026-09-07T19:00:00Z' }] }] })
beforeEach(() => vi.resetAllMocks())
it('renders escaped observations with table semantics and explicit scope', async () => {
  getLibrarySourceObservations.mockResolvedValue(fixture())
  const wrapper = mount(LibrarySourceObservations)
  await flushPromises()
  expect(wrapper.text()).toContain('Includes 1 of 2 active libraries')
  expect(wrapper.text()).toContain('Conflicting provider IDs (TMDb)')
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('caption').text()).toBe('Recent unresolved source items')
  expect(wrapper.findAll('th[scope="col"]')).toHaveLength(4)
  expect(wrapper.find('th[scope="row"]').exists()).toBe(true)
  expect(wrapper.find('[role="region"]').attributes('tabindex')).toBe('0')
  expect(wrapper.find('[role="status"]').text()).toBe('Source observations loaded.')
  wrapper.unmount()
})
it.each([['not_captured', 'coverage is unknown'], ['partial', 'absence is not established'],
  ['failed', 'Latest capture failed'], ['collecting', 'Capture in progress'], ['expired', 'current coverage is unknown'],
  ['capacity_exceeded', 'counts are withheld']])('distinguishes %s evidence', async (status, text) => {
  getLibrarySourceObservations.mockResolvedValue(fixture(status))
  const wrapper = mount(LibrarySourceObservations); await flushPromises()
  expect(wrapper.text()).toContain(text); wrapper.unmount()
})
it('retries a failed read without starting a source capture', async () => {
  getLibrarySourceObservations.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ ...fixture(), libraries: [] })
  const wrapper = mount(LibrarySourceObservations); await flushPromises()
  expect(wrapper.find('[role="alert"]').text()).toContain('unavailable')
  await wrapper.find('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('No active libraries')
  expect(getLibrarySourceObservations).toHaveBeenCalledTimes(2); wrapper.unmount()
})
it('ignores a read completed after unmount', async () => {
  let finish
  getLibrarySourceObservations.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const wrapper = mount(LibrarySourceObservations)
  expect(wrapper.attributes('aria-busy')).toBe('true'); wrapper.unmount()
  finish(fixture()); await flushPromises()
})
