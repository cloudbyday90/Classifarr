/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useLegacyIngestionReview } from '@/composables/useLegacyIngestionReview'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn(), receipt: vi.fn() }))
vi.mock('@/api/libraryIngestionApi', () => ({ previewLibraryIngestion: mocks.preview,
  reconcileLibraryIngestion: mocks.confirm, resumeLibraryIngestion: mocks.confirm,
  getLibraryIngestionReceipt: mocks.receipt }))
const preview = { revision: '"review"', canResume: true, syncs: [], capture: null }
const receipt = { auditId: 42, replay: 'scheduled' }
function harness(onReconciled = vi.fn()) {
  let review
  const id = ref(1)
  const wrapper = mount(defineComponent({ setup() { review = useLegacyIngestionReview(id, onReconciled); return () => null } }))
  return { wrapper, review, id, onReconciled }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.preview.mockResolvedValue(preview)
  mocks.confirm.mockResolvedValue({ data: { receipt } })
})

it('rejects programmatic confirmation during refresh, then requires fresh acknowledgment', async () => {
  const { wrapper, review } = harness()
  await flushPromises(); await review.refresh()
  const response = Promise.withResolvers()
  mocks.preview.mockReturnValueOnce(response.promise)
  const refreshing = review.refresh()
  review.acknowledged.value = true
  await review.confirm()
  expect(mocks.confirm).not.toHaveBeenCalled()
  response.resolve({ ...preview, revision: '"fresh"' }); await refreshing; await flushPromises()
  expect(review.acknowledged.value).toBe(false)
  review.acknowledged.value = true
  await review.confirm()
  expect(mocks.confirm.mock.calls[0][2]).toBe('"fresh"')
  await review.confirm()
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

it.each(['confirm', 'lookup'])('a %s receipt survives a failed progress callback', async operation => {
  const { wrapper, review } = harness(vi.fn().mockRejectedValue(new Error('progress unavailable')))
  await flushPromises(); await review.refresh(); review.acknowledged.value = true
  if (operation === 'lookup') mocks.confirm.mockRejectedValueOnce(new Error('lost'))
  await review.confirm()
  if (operation === 'lookup') {
    mocks.receipt.mockResolvedValueOnce({ receipt })
    await review.checkOutcome()
  }
  expect(review.receipt.value).toEqual(receipt)
  expect(review.pending.value).toBeNull()
  expect(review.error.value).toContain('Recovery is recorded')
  expect(review.error.value).not.toContain('unverified')
  expect(review.busy.value).toBe(false)
  wrapper.unmount()
})

it.each(['confirm', 'lookup'])('does not call progress callbacks after unmount during %s', async operation => {
  const { wrapper, review, onReconciled } = harness()
  await flushPromises(); await review.refresh(); review.acknowledged.value = true
  const response = Promise.withResolvers()
  let work
  if (operation === 'confirm') {
    mocks.confirm.mockReturnValueOnce(response.promise)
    work = review.confirm()
  } else {
    mocks.confirm.mockRejectedValueOnce(new Error('lost'))
    await review.confirm()
    mocks.receipt.mockReturnValueOnce(response.promise)
    work = review.checkOutcome()
  }
  wrapper.unmount()
  response.resolve(operation === 'confirm' ? { data: { receipt } } : { receipt })
  await work
  expect(onReconciled).not.toHaveBeenCalled()
  expect(review.receipt.value).toBeNull()
  await review.refresh(); await review.confirm(); await review.checkOutcome()
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
})

it('does not publish a callback error to a later visit', async () => {
  const callback = Promise.withResolvers()
  const { wrapper, review, id } = harness(() => callback.promise)
  await flushPromises(); await review.refresh(); review.acknowledged.value = true
  const confirming = review.confirm()
  await flushPromises()
  expect(review.receipt.value).toEqual(receipt)
  id.value = 2; id.value = 1
  callback.reject(new Error('old callback')); await confirming
  expect(review.error.value).toBe('')
  expect(review.receipt.value).toBeNull()
  wrapper.unmount()
})

it('preserves the original uncertain confirmation across offline and online events', async () => {
  const { wrapper, review } = harness()
  await flushPromises(); await review.refresh(); review.acknowledged.value = true
  mocks.confirm.mockRejectedValueOnce(new Error('lost response'))
  await review.confirm()
  const original = mocks.confirm.mock.calls[0]
  window.dispatchEvent(new Event('offline')); await flushPromises()
  expect(review.canConfirm.value).toBe(false)
  window.dispatchEvent(new Event('online')); await flushPromises()
  expect(mocks.preview).toHaveBeenCalledTimes(1)
  expect(review.pending.value.requestId).toBe(original[1].requestId)
  await review.refresh()
  expect(mocks.preview).toHaveBeenCalledTimes(1)
  await review.confirm()
  expect(mocks.confirm.mock.calls[1]).toEqual(original)
  expect(review.receipt.value).toEqual(receipt)
  window.dispatchEvent(new Event('offline')); await flushPromises()
  window.dispatchEvent(new Event('online')); await flushPromises()
  expect(mocks.preview).toHaveBeenCalledTimes(1)
  expect(review.receipt.value).toEqual(receipt)
  wrapper.unmount()
})

it('fails closed when a current preview fails and permits a new explicit review', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { wrapper, review } = harness()
  try {
    await flushPromises(); await review.refresh(); review.acknowledged.value = true
    mocks.preview.mockRejectedValueOnce(new Error('unavailable'))
    await review.refresh()
    review.acknowledged.value = true
    await review.confirm()
    expect(review.error.value).toContain('Review unavailable')
    expect(mocks.confirm).not.toHaveBeenCalled()
    await review.refresh(); await flushPromises()
    expect(review.acknowledged.value).toBe(false)
    review.acknowledged.value = true
    await review.confirm()
    expect(review.receipt.value).toEqual(receipt)
  } finally { wrapper.unmount(); logged.mockRestore() }
})
