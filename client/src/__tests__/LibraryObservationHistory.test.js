/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryObservationHistory from '@/components/library/LibraryObservationHistory.vue'
import { getLibraryObservationHistory } from '@/api/libraryCatalogApi'
import { observationHistoryTime, observationHistoryRatio } from '@/utils/observationHistoryDisplay'
import { libraryObservationHistoryFixture } from './fixtures/libraryObservationHistoryFixture'

vi.mock('@/api/libraryCatalogApi', () => ({ getLibraryObservationHistory: vi.fn() }))
beforeEach(() => { vi.resetAllMocks() })
async function render(report = libraryObservationHistoryFixture()) {
  getLibraryObservationHistory.mockResolvedValue(report)
  const wrapper = mount(LibraryObservationHistory)
  await flushPromises()
  return wrapper
}
describe('automatic acquisition history', () => {
  it('loads once with explicit populations, denominators and accessible tables', async () => {
    const wrapper = await render()
    expect(getLibraryObservationHistory).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="status"]').text()).toBe('Acquisition history loaded.')
    expect(wrapper.text()).toContain('keywords 4 / 8 (50%)')
    expect(wrapper.text()).toContain('language 2 / 8 (25%)')
    expect(wrapper.text()).toContain('across all inventory')
    expect(wrapper.text()).toContain('Libraries: 1, 2. Excluded: 1.')
    expect(wrapper.findAll('details')).toHaveLength(2)
    expect(wrapper.findAll('caption')).toHaveLength(2)
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(11)
    expect(wrapper.findAll('[role="region"][tabindex="0"]')).toHaveLength(2)
    expect(wrapper.find('button').exists()).toBe(false)
  })
  it('does not invent samples or outcomes during gaps', async () => {
    const wrapper = await render({ ...libraryObservationHistoryFixture(), activity: [], samples: [] })
    expect(wrapper.text()).toContain('No coverage samples have been recorded yet')
    expect(wrapper.text()).toContain('No acquisition outcomes have been recorded')
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it('withholds capacity-exceeded values and discloses configuration absence', async () => {
    const report = libraryObservationHistoryFixture()
    Object.assign(report.samples[0], { status: 'capacity_exceeded', acquisitionConfigured: false,
      inventoryRows: null, identifiedRows: null, capturedRows: null })
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('Coverage counts are withheld')
    expect(wrapper.text()).toContain('Acquisition was not configured')
    expect(wrapper.text()).not.toContain('null%')
  })
  it('shows empty populations and preserves unknown ratios', async () => {
    const report = libraryObservationHistoryFixture()
    Object.assign(report.samples[0], { libraryIds: [], inventoryRows: 0, identifiedRows: 0 })
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('Libraries: none')
    expect(wrapper.text()).toContain('(unknown)')
    expect(observationHistoryRatio(null, null)).toBe('Unknown')
    expect(observationHistoryTime('bad')).toBe('Unknown time')
  })
  it.each([null, {}])('treats an invalid response as unavailable: %j', async report => {
    expect((await render(report)).get('[role="alert"]').text()).toContain('unavailable')
  })
  it('offers retry after a generic error and ignores private error text', async () => {
    getLibraryObservationHistory.mockRejectedValueOnce(new Error('PRIVATE')).mockResolvedValueOnce(libraryObservationHistoryFixture())
    const wrapper = mount(LibraryObservationHistory)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).not.toContain('PRIVATE')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('Acquisition history loaded.')
  })
  it.each([false, true])('ignores late responses after unmount, rejected=%s', async reject => {
    let finish
    getLibraryObservationHistory.mockImplementation(() => new Promise((resolve, failure) => { finish = reject ? failure : resolve }))
    const wrapper = mount(LibraryObservationHistory)
    wrapper.unmount()
    finish(reject ? new Error('PRIVATE') : libraryObservationHistoryFixture())
    await flushPromises()
    expect(wrapper.exists()).toBe(false)
  })
})
