/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryOverlapSummary from '@/components/library/LibraryOverlapSummary.vue'
import { getLibraryOverlap } from '@/api/libraryCatalogApi'
import { libraryOverlapFixture } from './fixtures/libraryOverlapFixture'

vi.mock('@/api/libraryCatalogApi', () => ({ getLibraryOverlap: vi.fn() }))
beforeEach(() => { vi.resetAllMocks() })
async function render(report = libraryOverlapFixture()) {
  getLibraryOverlap.mockResolvedValue(report)
  const wrapper = mount(LibraryOverlapSummary)
  await flushPromises()
  return wrapper
}

describe('automatic library overlap summary', () => {
  it('loads once and provides captions, scoped headers and both overlap denominators', async () => {
    const wrapper = await render()
    expect(getLibraryOverlap).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="status"]').text()).toBe('Library comparisons loaded: 1.')
    expect(wrapper.get('caption').text()).toBe('Inventory and identity coverage')
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(6)
    expect(wrapper.findAll('th[scope="row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('3 / 4 (75%)')
    expect(wrapper.text()).toContain('1 / 2 (50%) of Movies (#1)')
    expect(wrapper.text()).toContain('1 / 1 (100%) of Family (#2)')
    expect(wrapper.text()).toContain('unidentified rows may contain additional overlap')
    expect(wrapper.find('button').exists()).toBe(false)
  })
  it('exposes trait coverage, conflicts, bounded values and insufficient coverage in native disclosures', async () => {
    const wrapper = await render()
    expect(wrapper.get('summary').text()).toContain('Movies (#1) / Family (#2) (movie)')
    expect(wrapper.get('details').text()).toContain('Counts describe each whole identified cohort')
    expect(wrapper.text()).toContain('Conflicting duplicate observations are unknown')
    expect(wrapper.text()).toContain('Insufficient coverage to compare this trait')
    expect(wrapper.text()).toContain('No common values among observed traits')
    expect(wrapper.text()).toContain('Showing 1 of 6 common values')
    expect(wrapper.text()).toContain('Drama — Movies (#1): 1 / 2 (50%); Family (#2): 1 / 1 (100%)')
  })
  it('reports omitted libraries and trait fields, unsupported rows and empty libraries', async () => {
    const report = libraryOverlapFixture()
    report.scope.excludedLibraryCount = 2
    report.scope.activeLibraryCount = 4
    Object.assign(report.libraries[0], { omittedTraitRowCount: 2, unsupportedTypeRowCount: 3 })
    Object.assign(report.libraries[1], { inventoryRowCount: 0, cohorts: [] })
    report.pairs = []
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('2 active libraries are outside this comparison')
    expect(wrapper.text()).toContain('2 rows have oversized trait fields withheld')
    expect(wrapper.text()).toContain('3 rows have an unsupported media type')
    expect(wrapper.text()).toContain('No inventory rows')
    expect(wrapper.text()).toContain('No two selected libraries')
  })
  it('does not present zero overlap when one side has no known identities', async () => {
    const report = libraryOverlapFixture()
    report.pairs[0].identityStatus = 'insufficient_coverage'
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('Insufficient identity coverage to compare these libraries')
    expect(wrapper.text()).not.toContain('Shared identities:')
  })
  it('does not warn of partial identity coverage when the cohorts are fully identified', async () => {
    const report = libraryOverlapFixture()
    report.pairs[0].identityStatus = 'complete_coverage'
    expect((await render(report)).text()).not.toContain('Partial identity coverage')
  })
  it('withholds inventory counts and comparisons at capacity', async () => {
    const report = libraryOverlapFixture()
    report.status = 'capacity_exceeded'
    report.libraries = [{ id: 1, name: 'Movies' }]
    report.pairs = []
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('exceed the 20000-row inventory limit')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('details').exists()).toBe(false)
  })
  it('handles an empty active population without inventing comparisons', async () => {
    const report = libraryOverlapFixture()
    report.libraries = []
    report.pairs = []
    report.scope = { ...report.scope, selectedLibraryCount: 0, activeLibraryCount: 0 }
    const wrapper = await render(report)
    expect(wrapper.text()).toContain('Includes 0 of 0 active libraries')
    expect(wrapper.find('table').exists()).toBe(false)
  })
  it('escapes library and trait text instead of rendering supplied markup', async () => {
    const report = libraryOverlapFixture()
    report.libraries[0].name = '<img src=x onerror=alert(1)>'
    report.pairs[0].traits[0].entries[0].value = '<script>bad()</script>'
    const wrapper = await render(report)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>bad()</script>')
  })
  it('announces loading and retries a failed read without exposing backend error text', async () => {
    let reject
    getLibraryOverlap.mockReturnValueOnce(new Promise((resolve, fail) => { reject = fail }))
    const wrapper = mount(LibraryOverlapSummary)
    expect(wrapper.get('[role="status"]').text()).toContain('Loading library comparison')
    expect(wrapper.get('section').attributes('aria-busy')).toBe('true')
    reject(new Error('PRIVATE DATABASE DETAIL'))
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('unavailable')
    expect(wrapper.text()).not.toContain('PRIVATE')
    getLibraryOverlap.mockResolvedValueOnce(libraryOverlapFixture())
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(getLibraryOverlap).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('section').attributes('aria-busy')).toBe('false')
  })
  it.each([true, false])('ignores late responses after unmount (success=%s)', async success => {
    let settle
    getLibraryOverlap.mockReturnValueOnce(new Promise((resolve, reject) => { settle = success ? resolve : reject }))
    const wrapper = mount(LibraryOverlapSummary)
    wrapper.unmount()
    settle(success ? libraryOverlapFixture() : new Error('unavailable'))
    await flushPromises()
    expect(getLibraryOverlap).toHaveBeenCalledTimes(1)
  })
})
