/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryObservationSampling from '@/components/library/LibraryObservationSampling.vue'
import LibraryObservationHistory from '@/components/library/LibraryObservationHistory.vue'
import { getLibraryObservationHistory } from '@/api/libraryCatalogApi'
import { observationTrendUnchanged } from '@/utils/observationTrendDisplay'
import { libraryObservationSamplingFixture } from './fixtures/libraryObservationSamplingFixture'
vi.mock('@/api/libraryCatalogApi', () => ({ getLibraryObservationHistory: vi.fn() }))
beforeEach(() => { vi.resetAllMocks() })
const render = (report = libraryObservationSamplingFixture(), libraries = []) => mount(LibraryObservationSampling,
  { props: { sampling: report.librarySampling, points: report.librarySamples, libraries } })

describe('fair library sampling', () => {
  it('shows isolated capacity, actual visit times, escaped names and bounded summaries', () => {
    const wrapper = render(undefined, [{ id: 1, name: '<img src=x>' }])
    expect(wrapper.findAll('h4')).toHaveLength(12)
    expect(wrapper.get('h4').text()).toContain('<img src=x> (library 1)')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain("this library's coverage is unknown")
    expect(wrapper.text()).toContain('captured 1 / 2 (50%)')
    expect(wrapper.text()).toContain('65 minutes since the previous recorded visit')
    expect(wrapper.text()).toContain('1 sampled comparison.')
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it('paginates locally beyond library 12 and clamps the page after data changes', async () => {
    const wrapper = render()
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('disabled')).toBeDefined()
    await buttons[1].trigger('click')
    expect(wrapper.findAll('h4')).toHaveLength(1)
    expect(wrapper.get('h4').text()).toBe('Library 13')
    expect(wrapper.get('[role="status"]').text()).toBe('Page 2 of 2')
    expect(buttons[1].attributes('disabled')).toBeDefined()
    await buttons[0].trigger('click')
    expect(wrapper.findAll('h4')).toHaveLength(12)
    await buttons[1].trigger('click')
    await wrapper.setProps({ points: [] })
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.text()).toContain('No per-library visits')
  })
  it('mounts accessible visit tables only when disclosed and preserves unknown capacity counts', async () => {
    const wrapper = render()
    const details = wrapper.findAll('details')[0]
    details.element.open = true
    await details.trigger('toggle')
    expect(wrapper.get('caption').text()).toBe('Recorded coverage for Library 1, newest first')
    expect(wrapper.get('td[colspan="5"]').text()).toContain('counts withheld')
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(7)
    expect(wrapper.get('[role="region"]').attributes('tabindex')).toBe('0')
    details.element.open = false
    await details.trigger('toggle')
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it.each([['sampling_delayed', 'Sampling is delayed'], ['clock_anomaly', 'sampling clock is ahead'],
    ['awaiting_samples', 'has not recorded a visit']])('explains sampling state %s', (status, message) => {
    const report = libraryObservationSamplingFixture()
    report.librarySampling.status = status
    if (status === 'awaiting_samples') report.librarySampling.lastSampleAt = null
    expect(render(report).text()).toContain(message)
  })
  it('loads once, retains earlier hourly history separately and does not refetch on paging', async () => {
    getLibraryObservationHistory.mockResolvedValue(libraryObservationSamplingFixture({ legacy: true }))
    const wrapper = mount(LibraryObservationHistory)
    await flushPromises()
    expect(wrapper.text()).toContain('Earlier hourly coverage from legacy sampling')
    await wrapper.findAll('button').find(button => button.text() === 'Next libraries').trigger('click')
    expect(getLibraryObservationHistory).toHaveBeenCalledTimes(1)
  })
  it.each([{ version: 'unknown' }, { version: 'library.observation_sampling.v2' }])('rejects malformed sampling responses: %j', async librarySampling => {
    getLibraryObservationHistory.mockResolvedValue({ activity: [], samples: [], librarySampling })
    const wrapper = mount(LibraryObservationHistory)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('unavailable')
  })
  it('shows acquisition absence, changed populations across missed slots, and sampled plural comparisons', () => {
    const report = libraryObservationSamplingFixture()
    Object.assign(report.librarySamples.find(row => row.libraryId === 2), { comparison: 'sampling_gap', populationChanged: true, acquisitionConfigured: false })
    const wrapper = render(report)
    expect(wrapper.text()).toContain('Inventory population also changed')
    expect(wrapper.text()).toContain('Acquisition was not configured')
    expect(observationTrendUnchanged({ unchangedComparisons: 2 })).toContain('2 sampled comparisons.')
  })
})
