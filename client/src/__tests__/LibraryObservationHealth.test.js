/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryObservationHealth from '@/components/library/LibraryObservationHealth.vue'
import { getLibraryObservationHealth } from '@/api/libraryCatalogApi'
import { libraryObservationHealthFixture } from './fixtures/libraryObservationHealthFixture'

vi.mock('@/api/libraryCatalogApi', () => ({ getLibraryObservationHealth: vi.fn() }))
beforeEach(() => { vi.resetAllMocks() })
async function render(report = libraryObservationHealthFixture()) {
  getLibraryObservationHealth.mockResolvedValue(report)
  const wrapper = mount(LibraryObservationHealth)
  await flushPromises()
  return wrapper
}

describe('automatic library observation health', () => {
  it('automatically loads coverage with explicit row denominators and accessible table headers', async () => {
    const wrapper = await render()
    expect(getLibraryObservationHealth).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="status"]').text()).toBe('Observation health loaded. Libraries measured: 1.')
    expect(wrapper.findAll('caption').map(value => value.text())).toEqual([
      'Observation coverage by library', 'Acquisition states for Movies (#1)',
    ])
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(8)
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(9)
    expect(wrapper.text()).toContain('6 / 7 (85.7%)')
    expect(wrapper.text()).toContain('1 / 6 (16.7%)')
    expect(wrapper.text()).toContain('A recent capture can still have missing traits')
    expect(wrapper.find('button').exists()).toBe(false)
  })
  it('uses native details to distinguish states, empty traits, queue activity and success times', async () => {
    const wrapper = await render()
    expect(wrapper.get('summary').text()).toBe('Observation details: Movies (#1)')
    expect(wrapper.text()).toContain('Each of the 8 inventory rows appears in one state')
    expect(wrapper.text()).toContain('Fresh captures are less than 30 days old')
    expect(wrapper.text()).toContain('Backoff lasts 6 hours')
    expect(wrapper.text()).toContain('Rows captured with no keywords: 1')
    expect(wrapper.text()).toContain('Rows captured with unknown original language: 1')
    expect(wrapper.text()).toContain('Invalid or mismatched observation records: 1')
    expect(wrapper.text()).toContain('processing: 1; pending: 2; no active task recorded: 5')
    expect(wrapper.text()).toContain('A task does not prove that TMDb will be called')
    expect(wrapper.text()).toContain('not a permanent success or failure history')
  })
  it('reports configuration absence and excluded libraries without prompting per-item work', async () => {
    const report = libraryObservationHealthFixture()
    report.acquisitionConfigured = false
    report.scope.excludedLibraryCount = 3
    report.scope.activeLibraryCount = 4
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('acquisition is not configured')
    expect(wrapper.text()).toContain('3 active libraries are outside this summary')
    expect(wrapper.find('button').exists()).toBe(false)
  })
  it('withholds every sampled percentage when inventory exceeds capacity', async () => {
    const report = libraryObservationHealthFixture()
    report.status = 'capacity_exceeded'
    report.libraries = [{ id: 1, name: 'Movies' }]
    const wrapper = await render(report)
    expect(wrapper.get('[role="status"]').text()).toContain('exceeds the inventory limit')
    expect(wrapper.text()).toContain('selected inventory exceeds 20000 rows')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('details').exists()).toBe(false)
  })
  it('uses unknown percentages and unrecorded times instead of invented values', async () => {
    const report = libraryObservationHealthFixture()
    Object.assign(report.libraries[0], { identityCoveragePercent: null, keywordCoveragePercent: null,
      languageCoveragePercent: null, lastSuccessfulObservationAt: null, oldestSuccessfulObservationAt: null })
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('(unknown)')
    expect(wrapper.text()).toContain('Not recorded')
    expect(wrapper.text()).not.toContain('null%')
  })
  it('handles an empty active population', async () => {
    const report = libraryObservationHealthFixture()
    report.libraries = []
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('No active libraries are available')
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it('escapes source library names', async () => {
    const report = libraryObservationHealthFixture()
    report.libraries[0].name = '<img src=x onerror=alert(1)>'
    const wrapper = await render(report)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })
  it('announces loading, hides backend error details and retries the failed read', async () => {
    let reject
    getLibraryObservationHealth.mockReturnValueOnce(new Promise((resolve, fail) => { reject = fail }))
    const wrapper = mount(LibraryObservationHealth)
    expect(wrapper.get('[role="status"]').text()).toContain('Loading observation health')
    expect(wrapper.get('section').attributes('aria-busy')).toBe('true')
    reject(new Error('PRIVATE DATABASE DETAIL'))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('unavailable')
    expect(wrapper.text()).not.toContain('PRIVATE')
    getLibraryObservationHealth.mockResolvedValueOnce(libraryObservationHealthFixture())
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(getLibraryObservationHealth).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('section').attributes('aria-busy')).toBe('false')
  })
  it.each([true, false])('ignores late requests after unmount (success=%s)', async success => {
    let settle
    getLibraryObservationHealth.mockReturnValueOnce(new Promise((resolve, reject) => { settle = success ? resolve : reject }))
    const wrapper = mount(LibraryObservationHealth)
    wrapper.unmount()
    settle(success ? libraryObservationHealthFixture() : new Error('unavailable'))
    await flushPromises()
    expect(getLibraryObservationHealth).toHaveBeenCalledTimes(1)
  })
})
