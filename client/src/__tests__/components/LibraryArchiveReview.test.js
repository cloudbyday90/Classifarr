/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LibraryArchiveReview from '@/components/library/LibraryArchiveReview.vue'
const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn(), receipt: vi.fn() }))
vi.mock('@/api/libraryArchiveApi', () => ({ previewLibraryArchive: mocks.preview,
  confirmLibraryArchive: mocks.confirm, getLibraryArchiveReceipt: mocks.receipt }))
const preview = { revision: '"revision"', operation: 'archive', canConfirm: true, reason: 'ready',
  library: { id: 1, name: 'Example' }, itemCount: 7, effect: 'Preserve inventory and history.' }
const button = (wrapper, text) => wrapper.findAll('button').find(candidate => candidate.text() === text)
async function open(wrapper) { await button(wrapper, 'Review archive status').trigger('click'); await flushPromises() }
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear()
  mocks.preview.mockResolvedValue(structuredClone(preview))
  mocks.confirm.mockResolvedValue({ data: { receipt: { auditId: 42 } } })
  mocks.receipt.mockResolvedValue({ status: 'not_observed', receipt: null })
})
afterEach(() => vi.unstubAllGlobals())

it('does no preview work until requested, requires a labeled attestation, and shows a receipt without enabling', async () => {
  const wrapper = mount(LibraryArchiveReview, { props: { libraryId: 1 } })
  await flushPromises(); expect(mocks.preview).not.toHaveBeenCalled()
  await open(wrapper)
  expect(wrapper.text()).toContain('7 inventory items preserved')
  expect(wrapper.get('label').text()).toContain('I reviewed')
  expect(button(wrapper, 'Archive reviewed library').attributes('disabled')).toBeDefined()
  await wrapper.get('input[type=checkbox]').setValue(true)
  await button(wrapper, 'Archive reviewed library').trigger('click'); await flushPromises()
  expect(mocks.confirm).toHaveBeenCalledWith(1, { workersStopped: true, operation: 'archive', requestId: expect.any(String) }, '"revision"')
  expect(wrapper.text()).toContain('receipt #42')
  expect(wrapper.emitted('changed')).toHaveLength(1)
  expect(localStorage.length).toBe(0)
  wrapper.unmount()
})

it('rejects stale approval and requires a new review and attestation', async () => {
  mocks.confirm.mockRejectedValueOnce({ response: { status: 412 } })
  const wrapper = mount(LibraryArchiveReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Archive reviewed library').trigger('click'); await flushPromises()
  expect(wrapper.get('[role=alert]').text()).toContain('Refresh the review')
  expect(wrapper.get('input').element.checked).toBe(false)
  await wrapper.get('input').setValue(true)
  expect(button(wrapper, 'Archive reviewed library').attributes('disabled')).toBeDefined()
  await button(wrapper, 'Refresh archive review').trigger('click'); await flushPromises()
  expect(wrapper.get('input').element.checked).toBe(false)
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

it('recovers a lost response through a read-only receipt lookup without a second write', async () => {
  mocks.confirm.mockRejectedValueOnce(new Error('connection lost'))
  const wrapper = mount(LibraryArchiveReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Archive reviewed library').trigger('click'); await flushPromises()
  const requestId = mocks.confirm.mock.calls[0][1].requestId
  expect(wrapper.text()).toContain('Outcome unverified')
  expect(button(wrapper, 'Refresh archive review').attributes('disabled')).toBeDefined()
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
  const wrapper = mount(LibraryArchiveReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Archive reviewed library').trigger('click'); await flushPromises()
  const pending = Promise.withResolvers()
  mocks.confirm.mockReturnValueOnce(pending.promise)
  await button(wrapper, 'Retry same confirmation').trigger('click')
  expect(mocks.confirm.mock.calls[1]).toEqual(mocks.confirm.mock.calls[0])
  await wrapper.setProps({ libraryId: 2 })
  pending.resolve({ data: { receipt: { auditId: 99 } } }); await flushPromises()
  expect(wrapper.text()).not.toContain('receipt #99')
  expect(wrapper.emitted('changed')).toBeUndefined()
  wrapper.unmount()
})

it.each([403, 409, 412])('keeps an unknown original outcome when a retry is rejected with %s', async status => {
  mocks.confirm.mockRejectedValueOnce(new Error('response lost'))
    .mockRejectedValueOnce({ response: { status } })
  const wrapper = mount(LibraryArchiveReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  await button(wrapper, 'Archive reviewed library').trigger('click'); await flushPromises()
  const requestId = mocks.confirm.mock.calls[0][1].requestId
  await button(wrapper, 'Retry same confirmation').trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('Not applied')
  expect(wrapper.text()).toContain('Outcome unverified')
  expect(mocks.confirm.mock.calls[1]).toEqual(mocks.confirm.mock.calls[0])
  mocks.receipt.mockResolvedValueOnce({ receipt: { auditId: 44 } })
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(mocks.receipt).toHaveBeenCalledWith(1, requestId)
  expect(wrapper.text()).toContain('receipt #44')
  wrapper.unmount()
})

it('does not send a confirmation without secure browser randomness', async () => {
  const wrapper = mount(LibraryArchiveReview, { props: { libraryId: 1 } })
  await open(wrapper); await wrapper.get('input').setValue(true)
  vi.stubGlobal('crypto', {})
  await button(wrapper, 'Archive reviewed library').trigger('click'); await flushPromises()
  expect(mocks.confirm).not.toHaveBeenCalled()
  expect(wrapper.get('[role=alert]').text()).toContain('No confirmation was sent')
  wrapper.unmount()
})

it.each(['disable_library', 'active_owner', 'unfinished_import', 'still_visible', 'unknown'])('does not offer confirmation for %s', async reason => {
  mocks.preview.mockResolvedValueOnce({ ...preview, reason, canConfirm: false })
  const wrapper = mount(LibraryArchiveReview, { props: { libraryId: 1 } })
  await open(wrapper)
  expect(wrapper.find('input').exists()).toBe(false)
  expect(mocks.confirm).not.toHaveBeenCalled()
  wrapper.unmount()
})
