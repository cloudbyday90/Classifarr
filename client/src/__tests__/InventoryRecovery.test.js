/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import InventoryRecovery from '@/views/InventoryRecovery.vue'
import { getInventoryRecovery, getInventoryRecoveryPlexLink, getInventoryRecoveryProgress } from '@/api/inventoryRecoveryApi'
import { inventoryRecoveryFixture, inventoryRecoveryPlexUrl, inventoryRecoveryProgressFixture } from './fixtures/inventoryRecovery'
vi.mock('@/api/inventoryRecoveryApi', () => ({ getInventoryRecovery: vi.fn(), getInventoryRecoveryPlexLink: vi.fn(), getInventoryRecoveryProgress: vi.fn() }))
let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getInventoryRecovery).mockResolvedValue(inventoryRecoveryFixture())
  vi.mocked(getInventoryRecoveryProgress).mockResolvedValue(inventoryRecoveryProgressFixture())
  vi.mocked(getInventoryRecoveryPlexLink).mockResolvedValue({ status: 'unavailable', url: null })
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.useRealTimers() })
const render = () => { wrapper = mount(InventoryRecovery, { global: { stubs: { RouterLink: true } } }); return wrapper }
const button = label => wrapper.findAll('button').find(node => node.text() === label)
async function openItem() {
  wrapper.find('details').element.open = true
  await wrapper.find('details').trigger('toggle'); await flushPromises()
}
it('shows concise counts, escapes titles and never persists or prefetches links', async () => {
  const value = inventoryRecoveryFixture()
  value.items[0].title = '<img src=x onerror=alert(1)>'
  vi.mocked(getInventoryRecovery).mockResolvedValue(value)
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  render(); await flushPromises()
  expect(wrapper.findAll('dd').map(node => node.text())).toEqual(['1', '1', '0'])
  expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('not a guaranteed start time')
  expect(storage).not.toHaveBeenCalled(); expect(getInventoryRecoveryPlexLink).not.toHaveBeenCalled()
})
it('loads a link only for expanded details, recovers after an offline read and blocks unsafe URLs', async () => {
  render(); await flushPromises(); await openItem()
  expect(wrapper.text()).toContain('Plex link unavailable')
  vi.mocked(getInventoryRecoveryPlexLink).mockResolvedValue({ status: 'available', url: 'javascript:alert(1)' })
  await button('Check Plex link again').trigger('click'); await flushPromises()
  expect(wrapper.find('a[target]').exists()).toBe(false)
  vi.mocked(getInventoryRecoveryPlexLink).mockResolvedValue({ status: 'available', url: inventoryRecoveryPlexUrl })
  await button('Check Plex link again').trigger('click'); await flushPromises()
  expect(wrapper.find('a[target]').attributes()).toMatchObject({ href: inventoryRecoveryPlexUrl, rel: 'noopener noreferrer' })
})
it('uses fixed failure copy and hides data after permission loss even while paused', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(); await flushPromises(); await button('Pause updates').trigger('click')
  vi.mocked(getInventoryRecovery).mockRejectedValue({ message: 'private', response: { status: 403 } })
  await button('Refresh cases').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('active administrator session')
  expect(wrapper.text()).not.toContain('Example movie'); expect(wrapper.text()).not.toContain('private')
})
it('withholds invalid snapshots rather than asserting healthy zero', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getInventoryRecovery).mockResolvedValue({ total: 0 })
  render(); await flushPromises()
  expect(wrapper.text()).toContain('Recovery data is unavailable')
  expect(wrapper.text()).not.toContain('No open recovery cases recorded')
})
it('pages without mixing snapshots and returns to the previous page', async () => {
  vi.mocked(getInventoryRecovery).mockImplementation(async afterId => inventoryRecoveryFixture(afterId, 26))
  render(); await flushPromises()
  await button('Next page').trigger('click'); await flushPromises()
  expect(wrapper.findAll('li').filter(node => node.classes().includes('rounded-xl'))).toHaveLength(1)
  expect(wrapper.text()).toContain('Example movie 26')
  await button('Previous page').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Example movie 1')
})
it('pauses display even when a read was already in flight, and manual refresh replaces the frozen snapshot', async () => {
  let release
  render(); await flushPromises()
  vi.mocked(getInventoryRecovery).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  await button('Refresh cases').trigger('click'); await flushPromises()
  await button('Pause updates').trigger('click')
  release(inventoryRecoveryFixture(0, 2)); await flushPromises()
  // Explicit refresh was requested before pausing; it must not replace the frozen display.
  expect(wrapper.findAll('dd')[0].text()).toBe('1')
  vi.mocked(getInventoryRecovery).mockResolvedValue(inventoryRecoveryFixture(0, 3))
  await button('Refresh cases').trigger('click'); await flushPromises()
  expect(wrapper.findAll('dd')[0].text()).toBe('3')
  await button('Resume updates').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Updates every 30 seconds')
})
it('has explicit empty, no-page, non-Plex and candidate-hint states', async () => {
  const report = inventoryRecoveryFixture()
  Object.assign(report.items[0], { isPlex: false, sourceReview: false,
    identityCheck: { checked_at: report.asOf, candidate_tmdb_id: 99 } })
  vi.mocked(getInventoryRecovery).mockResolvedValue(report)
  render(); await flushPromises(); await openItem()
  expect(wrapper.text()).toContain('review hint, not an applied correction')
  expect(wrapper.text()).toContain('direct link is not available for this source')
  expect(wrapper.find('ol').exists()).toBe(false)
  vi.mocked(getInventoryRecovery).mockResolvedValue(inventoryRecoveryFixture(0, 0))
  await button('Refresh cases').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('No open recovery cases recorded')
})
