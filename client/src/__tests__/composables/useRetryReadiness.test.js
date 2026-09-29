/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import api from '@/api'
import { useRetryReadiness } from '@/composables/useRetryReadiness'

vi.mock('@/api', () => ({ default: { getRetryReadiness: vi.fn(), getOmdbRetryReadiness: vi.fn() } }))
const report = () => ({ version: 1, scope: 'web_search', limitPerQueue: 50,
  observedAt: new Date().toISOString(), inspected: 1, hasMore: false, earliestRetryAt: null,
  counts: { cached_ready: 1, provider_ready: 0, provider_wait: 0, settings_blocked: 0, scheduled: 0, held: 0 } })
let wrapper, state
function start(scope, paused) {
  wrapper = mount(defineComponent({ setup() { state = useRetryReadiness(scope, paused); return () => null } }))
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T20:00:00Z'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  api.getRetryReadiness.mockReset().mockImplementation(async () => report())
  api.getOmdbRetryReadiness.mockReset().mockImplementation(async () => ({ ...report(), scope: 'omdb',
    counts: { ...report().counts, cached_ready: 0, provider_ready: 1 },
    quota: { status: 'available', used: 0, limit: 10, resetAt: null } }))
})
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('retry readiness memory-only SWR lifecycle', () => {
  it('mounts OMDb paused without fetching, then uses only its fixed endpoint', async () => {
    start('omdb', true); await flushPromises()
    expect(api.getOmdbRetryReadiness).not.toHaveBeenCalled()
    state.togglePaused(); await flushPromises()
    expect(state.report.value.scope).toBe('omdb'); expect(api.getRetryReadiness).not.toHaveBeenCalled()
  })
  it('discards late results after unmount so they cannot survive a provider switch', async () => {
    let complete
    api.getRetryReadiness.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    start(); await flushPromises(); const old = state
    wrapper.unmount(); start('omdb'); await flushPromises()
    complete(report()); await flushPromises()
    expect(old.report.value).toBeNull(); expect(state.report.value.scope).toBe('omdb')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.getRetryReadiness).toHaveBeenCalledTimes(1); expect(api.getOmdbRetryReadiness).toHaveBeenCalledTimes(2)
  })
  it('polls once per minute, respects pause, and releases timers on unmount', async () => {
    const stored = vi.spyOn(Storage.prototype, 'setItem')
    start(); await flushPromises()
    expect(state.report.value.inspected).toBe(1)
    expect(stored).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(60_000); expect(api.getRetryReadiness).toHaveBeenCalledTimes(2)
    state.togglePaused(); await nextTick()
    await vi.advanceTimersByTimeAsync(180_000); expect(api.getRetryReadiness).toHaveBeenCalledTimes(2)
    expect(state.stale.value).toBe(true)
    state.togglePaused(); await flushPromises(); expect(api.getRetryReadiness).toHaveBeenCalledTimes(3)
    wrapper.unmount(); await vi.advanceTimersByTimeAsync(180_000)
    expect(api.getRetryReadiness).toHaveBeenCalledTimes(3)
  })
  it('does not fetch in a hidden tab and recovers at the next visible poll', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    start(); await flushPromises(); await vi.advanceTimersByTimeAsync(60_000)
    expect(api.getRetryReadiness).not.toHaveBeenCalled()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.getRetryReadiness).toHaveBeenCalledTimes(1)
  })
  it('keeps the displayed snapshot frozen when an in-flight request finishes after pause', async () => {
    start(); await flushPromises()
    let complete
    api.getRetryReadiness.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    await vi.advanceTimersByTimeAsync(60_000)
    const before = state.report.value.observedAt
    state.togglePaused(); complete(report()); await flushPromises()
    expect(state.report.value.observedAt).toBe(before)
  })
  it.each([401, 403])('clears unauthorized data and stops polling on %s', async status => {
    start(); await flushPromises()
    api.getRetryReadiness.mockRejectedValue({ response: { status } })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.forbidden.value).toBe(true); expect(state.report.value).toBeNull()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(api.getRetryReadiness).toHaveBeenCalledTimes(2)
  })
  it('does not substitute zero for invalid data or failed refreshes; recovers next poll', async () => {
    api.getRetryReadiness.mockResolvedValueOnce({})
    start(); await flushPromises()
    expect(state.report.value).toBeNull(); expect(state.unavailable.value).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.report.value.inspected).toBe(1); expect(state.unavailable.value).toBe(false)
    api.getRetryReadiness.mockRejectedValueOnce(new Error('offline'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(state.unavailable.value).toBe(true); expect(state.report.value.inspected).toBe(1)
  })
  it('does not pass private transport details to the SWR logger', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.getRetryReadiness.mockRejectedValueOnce({ response: { status: 503, data: 'private-fixture' } })
    start(); await flushPromises()
    expect(logged).toHaveBeenCalledWith('[useSWR] Fetch error:', expect.objectContaining({ message: 'Retry readiness is unavailable' }))
    expect(JSON.stringify(logged.mock.calls)).not.toContain('private-fixture')
  })
})
