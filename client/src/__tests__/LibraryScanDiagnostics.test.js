/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryObservationHistory from '@/components/library/LibraryObservationHistory.vue'
import LibraryObservationSampling from '@/components/library/LibraryObservationSampling.vue'
import { getLibraryObservationHistory } from '@/api/libraryCatalogApi'
import { libraryScanDiagnosticsFixture } from './fixtures/libraryScanDiagnosticsFixture'

vi.mock('@/api/libraryCatalogApi', () => ({ getLibraryObservationHistory: vi.fn() }))
beforeEach(() => { vi.resetAllMocks() })
const render = (report = libraryScanDiagnosticsFixture(), libraries = []) => mount(LibraryObservationSampling, {
  props: { sampling: report.librarySampling, points: report.librarySamples, diagnostics: report.scanDiagnostics, libraries },
})

it('automatically prioritizes active unresolved libraries, with bounded local pagination', async () => {
  const wrapper = render()
  expect(wrapper.findAll('h4').map(heading => heading.text()).slice(0, 5)).toEqual(['Library 13', 'Library 12', 'Library 1', 'Library 3', 'Library 2'])
  expect(wrapper.findAll('h4')).toHaveLength(12)
  await wrapper.findAll('button').find(button => button.text() === 'Next libraries').trigger('click')
  expect(wrapper.get('h4').text()).toBe('Library 11')
  expect(wrapper.get('[role="status"]').text()).toBe('Page 2 of 2')
})

it('shows window-limited catalog absence, escaped unvisited names and explicit preview omissions', () => {
  const report = libraryScanDiagnosticsFixture()
  report.scanDiagnostics.catalog.unvisitedOmittedCount = 4
  const wrapper = render(report, [{ id: 14, name: '<img src=x>' }])
  expect(wrapper.text()).toContain('9 of 15 currently active libraries')
  expect(wrapper.text()).toContain('6 have none in this window')
  expect(wrapper.text()).toContain('2 have no incremental visits in this window')
  expect(wrapper.text()).toContain('<img src=x> (library 14); Library 15')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('4 more are not listed')
  expect(wrapper.text()).toContain('Missing retained completion does not mean a scan failed')
  expect(wrapper.text()).toContain('2026-08-29 12:05 UTC')
})

it('distinguishes reset counts, elapsed observation time and complete measurement baselines without alert spam', () => {
  const wrapper = render()
  expect(wrapper.text()).toContain('Repeated resets recorded: 2 restarts and 1 discarded visits in the retained window')
  expect(wrapper.text()).toContain('completed scan elapsed time: 65 minutes')
  expect(wrapper.text()).toContain('130 minutes before this report')
  expect(wrapper.text()).toContain('not continuous processing time')
  expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
  const reasons = wrapper.findAll('details').find(detail => detail.get('summary').text() === 'Recorded restart reasons for Library 13')
  expect(reasons.findAll('li')).toHaveLength(2)
  expect(reasons.text()).toContain('Discarded visits do not prove a subsequent restart')
})

it('keeps inactive historical findings out of priority and distinguishes legacy-only evidence', () => {
  const report = libraryScanDiagnosticsFixture()
  report.scanDiagnostics.libraries[12].isActive = false
  Object.assign(report.scanDiagnostics.libraries[0], { completionEvidence: 'legacy_only', visitCount: 0 })
  const wrapper = render(report)
  expect(wrapper.get('h4').text()).toBe('Library 12')
  expect(wrapper.text()).toContain('Only legacy visits are retained; incremental completion is unknown')
  // Put the inactive finding on the visible page without changing its priority.
  report.librarySamples = report.librarySamples.filter(point => point.libraryId !== 11)
  expect(render(report).text()).toContain('currently inactive or no longer in the catalog')
})

it('explains resets since a retained completion and tolerates unavailable catalog totals', () => {
  const report = libraryScanDiagnosticsFixture()
  report.scanDiagnostics.catalog = null
  report.scanDiagnostics.libraries[12].lastCompletedAt = '2026-09-05T09:00:00Z'
  const wrapper = render(report)
  expect(wrapper.text()).toContain('Current catalog totals are unavailable')
  expect(wrapper.text()).toContain('since the last retained completion')
})

it('loads the additive diagnostics once and uses no new requests for pagination or disclosure', async () => {
  getLibraryObservationHistory.mockResolvedValue(libraryScanDiagnosticsFixture())
  const wrapper = mount(LibraryObservationHistory)
  await flushPromises()
  expect(wrapper.text()).toContain('Automatic scan diagnostics')
  const reasons = wrapper.findAll('details')[0]
  reasons.element.open = true
  await reasons.trigger('toggle')
  await wrapper.findAll('button').find(button => button.text() === 'Next libraries').trigger('click')
  expect(getLibraryObservationHistory).toHaveBeenCalledTimes(1)
})

it.each([{ version: 'unknown', libraries: [] }, { version: 'library.scan_diagnostics.v1' }])('rejects unsupported diagnostics: %j', async scanDiagnostics => {
  getLibraryObservationHistory.mockResolvedValue({ ...libraryScanDiagnosticsFixture(), scanDiagnostics })
  const wrapper = mount(LibraryObservationHistory)
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('unavailable')
})
