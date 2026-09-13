/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MediaSyncRemediation from '@/components/settings/MediaSyncRemediation.vue'
import api from '@/api'

vi.mock('@/api', () => ({ default: { getLogError: vi.fn() } }))
const url = `https://app.plex.tv/desktop/#!/server/${'a'.repeat(40)}/details?key=%2Flibrary%2Fmetadata%2F123`
const remediation = { status: 'unresolved', explanation: 'Plex returned conflicting IDs.', scope: 'Current items.',
  recovery: 'Refresh retries links.', privacy: 'Review before sharing.', steps: ['Open the show.', 'Choose Fix Match.'],
  items: [{ sourceId: '123', title: '<img> Sample', year: 2006, mediaType: 'TV show', library: 'Shows', issue: 'TVDB conflict', plexUrl: null }] }
let wrapper
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  api.getLogError.mockResolvedValue({ remediation })
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers() })
function render(initial = remediation) { wrapper = mount(MediaSyncRemediation, { props: { errorId: 'same-log', remediation: initial } }); return wrapper }

describe('live Plex remediation', () => {
  it('does not change the displayed items when a pending automatic request completes after pause', async () => {
    let finish
    api.getLogError.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(); await flushPromises(); await wrapper.get('button').trigger('click')
    finish({ remediation: { ...remediation, items: [{ ...remediation.items[0], plexUrl: url }] } })
    await flushPromises(); expect(wrapper.find('a').exists()).toBe(false)
    await wrapper.get('button').trigger('click'); expect(wrapper.find('a').exists()).toBe(true)
  })
  it('backfills a missing link on the same warning after Plex comes online without persisting private data', async () => {
    render(); await flushPromises()
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('TVDB conflict'); expect(wrapper.find('img').exists()).toBe(false)
    api.getLogError.mockResolvedValue({ remediation: { ...remediation, items: [{ ...remediation.items[0], plexUrl: url }] } })
    await vi.advanceTimersByTimeAsync(30000); await flushPromises()
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe(url); expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.text()).toContain('Sample in Plex (new tab)'); expect(localStorage.length).toBe(0)
    expect(api.getLogError).toHaveBeenLastCalledWith('same-log')
  })
  it('pauses while hidden or explicitly paused and stops all polling on close', async () => {
    render(); await flushPromises(); api.getLogError.mockClear()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await vi.advanceTimersByTimeAsync(30000); expect(api.getLogError).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await wrapper.get('button').trigger('click'); await vi.advanceTimersByTimeAsync(60000)
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true'); expect(api.getLogError).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click'); await vi.advanceTimersByTimeAsync(30000)
    expect(api.getLogError).toHaveBeenCalledTimes(1)
    wrapper.unmount(); wrapper = null; api.getLogError.mockClear()
    await vi.advanceTimersByTimeAsync(60000); expect(api.getLogError).not.toHaveBeenCalled()
  })
  it('retains instructions during request failure and supports manual retry while paused', async () => {
    render(); await flushPromises(); await wrapper.get('button').trigger('click')
    api.getLogError.mockRejectedValueOnce({ response: { status: 403 } })
    await wrapper.findAll('button')[1].trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Could not refresh'); expect(wrapper.text()).toContain('Choose Fix Match.')
    api.getLogError.mockResolvedValue({ remediation: { ...remediation, status: 'no_current_records', items: [] } })
    await wrapper.findAll('button')[1].trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('does not prove Plex is fixed')
  })
  it.each(['javascript:alert(1)', 'https://evil.invalid', `${url}&X-Plex-Token=secret`, null])('does not render unsafe links: %s', async plexUrl => {
    const initial = { ...remediation, truncated: true, items: [{ ...remediation.items[0], plexUrl }] }
    api.getLogError.mockResolvedValue({ remediation: initial }); render(initial); await flushPromises()
    expect(wrapper.find('a').exists()).toBe(false); expect(wrapper.text()).toContain('first 50')
  })
})
