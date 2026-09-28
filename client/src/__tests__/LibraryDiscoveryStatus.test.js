/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import LibraryDiscoveryStatus from '@/components/settings/LibraryDiscoveryStatus.vue'
import { getLibraryDiscoveryStatus } from '@/api/mediaServerSetupApi'

vi.mock('@/api/mediaServerSetupApi', () => ({ getLibraryDiscoveryStatus: vi.fn() }))
const online = ref(true)
vi.mock('@vueuse/core', () => ({ useOnline: () => online }))
const report = (reason = 'complete') => ({ provider: 'jellyfin', reason, title: reason === 'complete' ? 'Library discovery complete' : 'Credentials were rejected',
  nextStep: reason === 'complete' ? 'Content ingestion and backfill have separate progress.' : 'Update the saved media-server token, save, then sync libraries.',
  lastSuccessAt: '2026-09-27T12:00:00.000Z', lastSuccessCount: 2, attemptedAt: '2026-09-27T13:00:00.000Z',
  contract: 'jellyfin_virtual_folders', httpStatus: reason === 'complete' ? null : 401 })
let wrapper
beforeEach(() => {
  vi.resetAllMocks()
  online.value = true
  localStorage.clear()
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks() })
async function render(data = report(), props = {}) {
  getLibraryDiscoveryStatus.mockResolvedValue(data)
  wrapper = mount(LibraryDiscoveryStatus, { props })
  await flushPromises()
  return wrapper
}
const syncButton = () => wrapper.findAll('button')[1]

describe('library discovery status', () => {
  it.each([
    ['scheduled', 'eligible after'], ['cooldown', 'one check per six hours'], ['waiting_configuration', 'waiting for updated connection settings'],
    ['needs_review', 'paused for review'], ['pending', 'next watchdog run'], ['not_configured', 'until a media server is configured'],
  ])('explains %s recovery in the existing polite status region without starting work', async (state, text) => {
    await render({ ...report(), recovery: { state, nextAttemptAt: '2026-09-27T18:00:00Z' } })
    expect(wrapper.get('[role="status"]').text()).toContain(text)
    expect(getLibraryDiscoveryStatus).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('sync')).toBeUndefined()
  })
  it('shows Jellyfin, last success, a count with clear meaning, and an accessible next step', async () => {
    await render()
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('[role="status"]').text()).toContain('Library discovery complete')
    expect(wrapper.text()).toContain('Jellyfin')
    expect(wrapper.text()).toContain('Movie / TV libraries at that scan')
    expect(wrapper.findAll('dd').map(value => value.text())).toContain('2')
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-09-27T12:00:00.000Z')
    expect(wrapper.get('details').text()).toContain('Jellyfin virtual folders')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(getLibraryDiscoveryStatus).toHaveBeenCalledTimes(1)
    expect(localStorage.length).toBe(0)
    expect(wrapper.emitted('sync')).toBeUndefined()
    await syncButton().trigger('click')
    expect(wrapper.emitted('sync')).toHaveLength(1)
    expect(wrapper.text()).toContain('Sync Libraries starts enabled-library content sync and queue refill')
  })
  it('preserves historical success beside an actionable current failure, without claiming recovery', async () => {
    await render(report('authentication'))
    expect(wrapper.text()).toContain('Credentials were rejected')
    expect(wrapper.text()).toContain('Update the saved media-server token')
    expect(wrapper.get('details').text()).toContain('HTTP 401')
    expect(wrapper.find('time').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Library discovery complete')
  })
  it('refreshes only the status and hides the old outcome while refreshing after configuration changes', async () => {
    await render()
    let resolve
    getLibraryDiscoveryStatus.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await wrapper.setProps({ refreshKey: 1 })
    expect(wrapper.text()).toContain('Checking the saved discovery result')
    expect(wrapper.text()).not.toContain('Library discovery complete')
    expect(syncButton().element.disabled).toBe(true)
    resolve(report('authentication'))
    await flushPromises()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(getLibraryDiscoveryStatus).toHaveBeenCalledTimes(3)
    expect(wrapper.emitted('sync')).toBeUndefined()
  })
  it('hides healthy cached data and private details after a failed read, without automatic retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await render()
    getLibraryDiscoveryStatus.mockRejectedValueOnce(new Error('PRIVATE PROVIDER TOKEN'))
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Status unavailable')
    expect(wrapper.text()).not.toMatch(/PRIVATE|Library discovery complete/)
    expect(syncButton().element.disabled).toBe(true)
    expect(getLibraryDiscoveryStatus).toHaveBeenCalledTimes(2)
  })
  it('hides healthy status offline and recovers via a read when connectivity returns', async () => {
    await render()
    online.value = false
    await nextTick()
    expect(wrapper.text()).toContain('Offline')
    expect(wrapper.find('time').exists()).toBe(false)
    expect(syncButton().element.disabled).toBe(true)
    online.value = true
    await flushPromises()
    expect(getLibraryDiscoveryStatus).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Library discovery complete')
  })
  it.each(['checking', 'not_configured'])('does not start work in %s state', async reason => {
    await render({ ...report(), reason, provider: reason === 'not_configured' ? null : 'jellyfin',
      lastSuccessAt: null, lastSuccessCount: null, contract: 'unknown', attemptedAt: null })
    expect(syncButton().element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Not recorded for this connection')
    expect(wrapper.text()).toContain('Not measured')
  })
  it('does not allow a duplicate sync while the existing parent sync is running', async () => {
    await render(report(), { syncing: true })
    expect(syncButton().element.disabled).toBe(true)
    expect(syncButton().text()).toContain('Syncing libraries')
  })
  it('escapes text and handles invalid timestamps without HTML insertion', async () => {
    await render({ ...report(), title: '<img src=x onerror=alert(1)>', attemptedAt: 'invalid' })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.get('details').text()).toContain('Last attempt: Not recorded')
  })
})
