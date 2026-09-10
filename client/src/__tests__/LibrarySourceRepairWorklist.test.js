/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibrarySourceRepairWorklist from '@/components/library/LibrarySourceRepairWorklist.vue'
import { getLibrarySourceRepairWorklist } from '@/api/libraryCatalogApi'

vi.mock('@/api/libraryCatalogApi', () => ({ getLibrarySourceRepairWorklist: vi.fn() }))

const fixture = () => ({
  status: { id: 'complete' }, observedAt: '2026-09-09T12:00:00Z',
  scope: { maximumEntries: 32, maximumEntriesPerLibrary: 8, retentionDays: 30, activeLibraryCount: 2, selectedLibraryCount: 1, selectedEntryCount: 1 },
  entries: [{ sourceFingerprint: 'fixture', library: { name: 'Movies' }, title: '<img src=x onerror=alert(1)>', year: 2020,
    mediaType: 'movie', identityIssue: 'conflicting_provider_ids', providerFields: ['tmdb_id'], lastSeenAt: '2026-09-09T11:00:00Z',
    repairActionId: 'correct_source_match_then_resync' }],
})

beforeEach(() => vi.resetAllMocks())

it('renders a bounded repair queue without rendering source content as HTML', async () => {
  getLibrarySourceRepairWorklist.mockResolvedValue(fixture())
  const wrapper = mount(LibrarySourceRepairWorklist)
  await flushPromises()
  expect(wrapper.text()).toContain('1 source conflicts selected')
  expect(wrapper.text()).toContain('Conflicting provider IDs (TMDb)')
  expect(wrapper.text()).toContain('Correct the source match, then run a full sync.')
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('caption').text()).toContain('source conflicts selected')
  expect(wrapper.findAll('th[scope="col"]')).toHaveLength(5)
  expect(wrapper.find('th[scope="row"]').text()).toBe('Movies')
  expect(wrapper.find('[role="region"]').attributes('tabindex')).toBe('0')
  wrapper.unmount()
})

it('states when no current complete-capture conflict needs repair', async () => {
  getLibrarySourceRepairWorklist.mockResolvedValue({ ...fixture(), status: { id: 'no_current_conflicts' }, entries: [],
    scope: { ...fixture().scope, selectedEntryCount: 0 } })
  const wrapper = mount(LibrarySourceRepairWorklist)
  await flushPromises()
  expect(wrapper.text()).toContain('No current complete-capture source conflicts need repair in this worklist window.')
  expect(wrapper.find('table').exists()).toBe(false)
  wrapper.unmount()
})

it('retries a failed read without requesting source repair', async () => {
  getLibrarySourceRepairWorklist.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(fixture())
  const wrapper = mount(LibrarySourceRepairWorklist)
  await flushPromises()
  expect(wrapper.find('[role="alert"]').text()).toContain('unavailable')
  await wrapper.find('button').trigger('click')
  await flushPromises()
  expect(wrapper.find('caption').exists()).toBe(true)
  expect(getLibrarySourceRepairWorklist).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})
