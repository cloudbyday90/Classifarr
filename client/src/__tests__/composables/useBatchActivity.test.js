/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useBatchActivity } from '@/composables/useBatchActivity'
import api from '@/api'

vi.mock('@/api', () => ({ default: { getReclassificationBatchActivity: vi.fn() } }))
const network = vi.hoisted(() => ({ online: null }))
vi.mock('@vueuse/core', () => ({ useOnline: () => network.online }))
const empty = { batches: [], nextCursor: null }
const row = { id: 12, status: 'paused', total: 1, completed: 0, failed: 0, skipped: 0, cancelled: 0, recovering: 0, attention: 0 }
const wrappers = []
function setup() {
  let result
  wrappers.push(mount(defineComponent({ setup() { result = useBatchActivity(); return () => null } })))
  return result
}

describe('saved batch SWR activity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    network.online = ref(true)
    api.getReclassificationBatchActivity.mockResolvedValue(empty)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.clear()
  })
  afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.useRealTimers(); vi.restoreAllMocks() })

  it('loads on mount, polls only visibly and never persists activity', async () => {
    const visible = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const result = setup()
    await flushPromises()
    expect(result.page.value).toEqual(empty)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(api.getReclassificationBatchActivity).toHaveBeenCalledTimes(2)
    visible.mockReturnValue('hidden')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(api.getReclassificationBatchActivity).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('classifarr:v1:swr:batch-activity')).toBeNull()
  })

  it('pages by server cursor and resets to current activity on refresh', async () => {
    api.getReclassificationBatchActivity.mockResolvedValueOnce({ batches: [row], nextCursor: '0:12' })
    const result = setup()
    await flushPromises()
    await result.nextPage()
    expect(api.getReclassificationBatchActivity).toHaveBeenLastCalledWith('0:12')
    expect(result.page.value).toEqual(empty)
    await result.nextPage()
    expect(api.getReclassificationBatchActivity).toHaveBeenCalledTimes(2)
    await result.refresh()
    expect(api.getReclassificationBatchActivity).toHaveBeenLastCalledWith(null)
  })

  it('does not display a previous page when refresh races an older read', async () => {
    api.getReclassificationBatchActivity.mockResolvedValueOnce({ batches: [row], nextCursor: '0:12' })
    const result = setup()
    await flushPromises()
    let finishOld
    api.getReclassificationBatchActivity.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const next = result.nextPage()
    expect(result.page.value).toBeNull()
    await result.nextPage() // suppressed while paging
    const refresh = result.refresh()
    finishOld({ batches: [{ ...row, id: 1 }], nextCursor: null })
    await Promise.all([next, refresh])
    expect(result.page.value).toEqual(empty)
    expect(api.getReclassificationBatchActivity).toHaveBeenLastCalledWith(null)
  })

  it.each([401, 403])('hides and stops requests after authorization denial %s', async status => {
    api.getReclassificationBatchActivity.mockRejectedValue({ response: { status } })
    const result = setup()
    await flushPromises()
    expect(result.available.value).toBe(false)
    expect(result.errorMessage.value).toBe('')
    await vi.advanceTimersByTimeAsync(60_000)
    await result.refresh()
    expect(api.getReclassificationBatchActivity).toHaveBeenCalledOnce()
  })

  it('removes stale state on failure, hides raw errors and recovers on reconnect', async () => {
    const result = setup()
    await flushPromises()
    api.getReclassificationBatchActivity.mockRejectedValueOnce(new Error('/private/token'))
    await result.refresh()
    expect(result.page.value).toBeNull()
    expect(result.errorMessage.value).toBe('Batch activity is unavailable. Refresh to try again.')
    network.online.value = false
    await flushPromises()
    network.online.value = true
    await flushPromises()
    expect(result.page.value).toEqual(empty)
    expect(result.errorMessage.value).toBe('')
  })

  it.each([{}, { batches: [], nextCursor: 1 }, { batches: Array(11).fill({}), nextCursor: null },
    { batches: [null], nextCursor: null }, { batches: [{ ...row, id: -1 }], nextCursor: null },
    { batches: [{ ...row, failed: -1 }], nextCursor: null },
    { batches: [{ ...row, status: null }], nextCursor: null },
    { batches: [{ ...row, status: 'invalid state' }], nextCursor: null },
    { batches: [], nextCursor: 'junk' }, { batches: [], nextCursor: '0:2147483648' },
  ])('rejects malformed or unbounded responses', async response => {
    api.getReclassificationBatchActivity.mockResolvedValue(response)
    const result = setup()
    await flushPromises()
    expect(result.page.value).toBeNull()
    expect(result.errorMessage.value).not.toBe('')
  })

  it('ignores responses after unmount', async () => {
    let finish
    api.getReclassificationBatchActivity.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const result = setup()
    wrappers[0].unmount()
    finish(empty)
    await flushPromises()
    expect(result.page.value).toBeNull()
  })
});
