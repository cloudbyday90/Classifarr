/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SourceIdentityIssuesPanel from '@/components/command-center/SourceIdentityIssuesPanel.vue'
import { getLibrarySourceIdentityIssues } from '@/api/libraryCatalogApi'
import { sourceIssuePage } from '../../fixtures/sourceIdentityIssues'

vi.mock('@/api/libraryCatalogApi', () => ({ getLibrarySourceIdentityIssues: vi.fn() }))
let wrapper
it('offers the draft review only when a current stored revision is available', async () => {
  const report = sourceIssuePage()
  report.items[0].sourceVersion = 'a'.repeat(64)
  vi.mocked(getLibrarySourceIdentityIssues).mockResolvedValue(report)
  render(); await flushPromises()
  expect(wrapper.text()).toContain('Draft a catalog mapping (admin)')
  report.items[0].sourceVersion = null
  await wrapper.find('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('Draft a catalog mapping (admin)')
})
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })
const render = () => {
  wrapper = mount(SourceIdentityIssuesPanel, { props: { expectedCount: 1 }, global: { stubs: { RouterLink: true } } })
  return wrapper
}
it('loads only matching items, escapes source text, and does not persist titles', async () => {
  const report = sourceIssuePage()
  report.items[0].title = '<img src=x onerror=alert(1)>'
  report.items[0].providerFields = ['tvdb_id']
  vi.mocked(getLibrarySourceIdentityIssues).mockResolvedValue(report)
  render()
  expect(wrapper.text()).toContain('Loading the matching items')
  await flushPromises()
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('Recovery not confirmed')
  expect(wrapper.text()).toContain('Conflicting IDs detected for: TVDB')
  expect(wrapper.text()).toContain('not a count of items without metadata')
  expect(wrapper.text()).toContain('may not be the only conflict')
  expect(localStorage.getItem('classifarr:v1:swr:command-center:source-identity-issues')).toBeNull()
  expect(getLibrarySourceIdentityIssues).toHaveBeenCalledWith(0)
})
it('paginates, explains changed totals, and clears details on access loss', async () => {
  vi.mocked(getLibrarySourceIdentityIssues).mockImplementation(async offset => sourceIssuePage(offset, 51))
  render(); await flushPromises()
  expect(wrapper.text()).toContain('The overview showed 1')
  await wrapper.findAll('button').find(button => button.text() === 'Next').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('51–51 of 51')
  expect(wrapper.text()).not.toContain('Fixture title 1')
  await wrapper.findAll('button').find(button => button.text() === 'First page').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('1–50 of 51')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getLibrarySourceIdentityIssues).mockRejectedValue({ response: { status: 403 } })
  await wrapper.find('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Metadata issues are unavailable')
  expect(wrapper.text()).not.toContain('Fixture title')
})
it('does not let an older response appear as the requested page', async () => {
  let release
  vi.mocked(getLibrarySourceIdentityIssues).mockResolvedValueOnce(sourceIssuePage(0, 51))
  render(); await flushPromises()
  vi.mocked(getLibrarySourceIdentityIssues).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  await wrapper.find('button').trigger('click')
  // Pagination during a refresh is disabled; only one page request can be active.
  expect(wrapper.findAll('button').find(button => button.text() === 'Next').attributes('disabled')).toBeDefined()
  release(sourceIssuePage(0, 51)); await flushPromises()
  expect(wrapper.text()).toContain('1–50 of 51')
})
it('withholds malformed snapshots instead of claiming zero issues', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getLibrarySourceIdentityIssues).mockResolvedValue({ total: 0 })
  render(); await flushPromises()
  expect(wrapper.text()).toContain('Metadata issues are unavailable')
  expect(wrapper.text()).not.toContain('No metadata issues')
})
it('shows the recorded cause and source check rather than a generic retry instruction', async () => {
  const report = sourceIssuePage()
  Object.assign(report.items[0], { recoveryState: 'source_review', lastRecovery: {
    reason: 'external_ids_disagree', attemptedAt: '2026-09-26T10:00:00Z', completedAt: '2026-09-26T11:00:00Z',
  } })
  report.recovery = { retry_wait: 0, retry_due: 0, source_review: 1, not_recorded: 0 }
  vi.mocked(getLibrarySourceIdentityIssues).mockResolvedValue(report)
  render(); await flushPromises()
  expect(wrapper.text()).toContain('Independent IDs point to different titles')
  expect(wrapper.text()).toContain('Result recorded:')
  expect(wrapper.text()).toContain('No conflicting ID was selected')
  expect(wrapper.text()).not.toContain('No action needed yet')
})
