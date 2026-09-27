/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LegacyIngestionReview from '@/components/library/LegacyIngestionReview.vue'
const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn(), receipt: vi.fn() }))
vi.mock('@/api/libraryIngestionApi', () => ({ previewLibraryIngestion: mocks.preview,
  reconcileLibraryIngestion: mocks.confirm, getLibraryIngestionReceipt: mocks.receipt }))
const preview = { revision: '"revision"', canReconcile: true, reason: 'confirmation_required',
  library: { id: 1 }, syncs: [{ id: 3, status: 'running', processed: 7 }], capture: { generation: 2, source: 'local_capture' } }
const button = (wrapper, text) => wrapper.findAll('button').find(candidate => candidate.text() === text)
async function open(wrapper) { await button(wrapper, 'Review blocked import').trigger('click'); await flushPromises() }
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear()
  mocks.preview.mockResolvedValue(structuredClone(preview))
  mocks.confirm.mockResolvedValue({ data: { receipt: { auditId: 42 } } })
  mocks.receipt.mockResolvedValue({ status: 'not_observed', receipt: null })
})
afterEach(() => vi.unstubAllGlobals())

it('does no preview work until requested, requires a labeled attestation, and shows a receipt without enabling', async () => {
  const wrapper = mount(LegacyIngestionReview, { props: { libraryId: 1 } })
  await flushPromises(); expect(mocks.preview).not.toHaveBeenCalled()
  await open(wrapper)
  expect(wrapper.text()).toContain('1 unfinished sync records')
  expect(wrapper.get('label').text()).toContain('I verified')
  expect(button(wrapper, 'Reconcile reviewed records').attributes('disabled')).toBeDefined()
  await wrapper.get('input[type=checkbox]').setValue(true)
  await button(wrapper, 'Reconcile reviewed records').trigger('click'); await flushPromises()
  expect(mocks.confirm).toHaveBeenCalledWith(1, { workersStopped: true, requestId: expect.any(String) }, '"revision"')
  expect(wrapper.text()).toContain('receipt #42')
  expect(wrapper.emitted('reconciled')).toHaveLength(1)
  expect(localStorage.length).toBe(0)
  wrapper.unmount()
})

it('rejects stale approval and requires a new review and attestation', async () => {
  mocks.confirm.mockRejectedValueOnce({ response: { status: 412 } })
  const wrapper = mount(LegacyIngestionReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Reconcile reviewed records').trigger('click'); await flushPromises()
  expect(wrapper.get('[role=alert]').text()).toContain('Refresh the review')
  expect(wrapper.get('input').element.checked).toBe(false)
  await wrapper.get('input').setValue(true)
  expect(button(wrapper, 'Reconcile reviewed records').attributes('disabled')).toBeDefined()
  await button(wrapper, 'Refresh review').trigger('click'); await flushPromises()
  expect(wrapper.get('input').element.checked).toBe(false)
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

it('recovers a lost response through a read-only receipt lookup without a second write', async () => {
  mocks.confirm.mockRejectedValueOnce(new Error('connection lost'))
  const wrapper = mount(LegacyIngestionReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Reconcile reviewed records').trigger('click'); await flushPromises()
  const requestId = mocks.confirm.mock.calls[0][1].requestId
  expect(wrapper.text()).toContain('outcome is unverified')
  expect(button(wrapper, 'Refresh review').attributes('disabled')).toBeDefined()
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('does not prove failure')
  mocks.receipt.mockResolvedValueOnce({ receipt: { auditId: 43 } })
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(mocks.receipt).toHaveBeenCalledWith(1, requestId)
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('receipt #43')
  wrapper.unmount()
})

it('retries an uncertain confirmation with the same request ID and ignores another library’s late reply', async () => {
  mocks.confirm.mockRejectedValueOnce(new Error('lost'))
  const wrapper = mount(LegacyIngestionReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Reconcile reviewed records').trigger('click'); await flushPromises()
  const pending = Promise.withResolvers()
  mocks.confirm.mockReturnValueOnce(pending.promise)
  await button(wrapper, 'Retry same confirmation').trigger('click')
  expect(mocks.confirm.mock.calls[1]).toEqual(mocks.confirm.mock.calls[0])
  await wrapper.setProps({ libraryId: 2 })
  pending.resolve({ data: { receipt: { auditId: 99 } } }); await flushPromises()
  expect(wrapper.text()).not.toContain('receipt #99')
  expect(wrapper.emitted('reconciled')).toBeUndefined()
  wrapper.unmount()
})

it.each([403, 409, 412])('keeps an unknown original outcome when a retry is rejected with %s', async status => {
  mocks.confirm.mockRejectedValueOnce(new Error('response lost'))
    .mockRejectedValueOnce({ response: { status } })
  const wrapper = mount(LegacyIngestionReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Reconcile reviewed records').trigger('click'); await flushPromises()
  const requestId = mocks.confirm.mock.calls[0][1].requestId
  await button(wrapper, 'Retry same confirmation').trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('Confirmation was not applied')
  expect(wrapper.text()).toContain('original confirmation outcome is unverified')
  expect(mocks.confirm.mock.calls[1]).toEqual(mocks.confirm.mock.calls[0])
  mocks.receipt.mockResolvedValueOnce({ receipt: { auditId: 44 } })
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(mocks.receipt).toHaveBeenCalledWith(1, requestId)
  expect(wrapper.text()).toContain('receipt #44')
  wrapper.unmount()
})

it('does not send a confirmation without secure browser randomness', async () => {
  const wrapper = mount(LegacyIngestionReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  vi.stubGlobal('crypto', {})
  await button(wrapper, 'Reconcile reviewed records').trigger('click'); await flushPromises()
  expect(mocks.confirm).not.toHaveBeenCalled()
  expect(wrapper.get('[role=alert]').text()).toContain('No request was sent')
  wrapper.unmount()
})

it.each(['disable_library', 'active_owner', 'not_needed', 'too_many_markers', 'unsupported_library'])('does not offer confirmation for %s', async reason => {
  mocks.preview.mockResolvedValueOnce({ ...preview, reason, canReconcile: false })
  const wrapper = mount(LegacyIngestionReview, { props: { libraryId: 1 } })
  await open(wrapper)
  expect(wrapper.find('input').exists()).toBe(false)
  expect(mocks.confirm).not.toHaveBeenCalled()
  wrapper.unmount()
})
