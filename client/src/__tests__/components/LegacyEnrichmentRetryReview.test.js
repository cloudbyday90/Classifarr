/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LegacyEnrichmentRetryReview from '@/components/library/LegacyEnrichmentRetryReview.vue'
const mocks = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn(), receipt: vi.fn() }))
vi.mock('@/api/legacyEnrichmentRetryApi', () => ({ previewLegacyEnrichmentRetries: mocks.preview,
  recoverLegacyEnrichmentRetries: mocks.confirm, getLegacyEnrichmentRetryReceipt: mocks.receipt }))
const preview = { revision: '"revision"', canRecover: true, reason: 'confirmation_required', hasMore: true,
  library: { id: 1, enabled: true }, items: [{ id: 3, title: '<script>example</script>', year: 2020, provider: 'omdb', attempts: 1, maxAttempts: 3, outcome: 'pending' },
    { id: 4, title: 'TV example', year: null, provider: 'web_search', attempts: 3, maxAttempts: 3, outcome: 'failed' }] }
const button = (wrapper, text) => wrapper.findAll('button').find(candidate => candidate.text() === text)
const receipt = (requestId, auditId = 42) => ({ requestId, auditId, libraryId: 1, queued: 1, exhausted: 1, confirmedAt: '2026-09-29T10:00:00.000Z' })
let wrappers = []
const fixture = () => { const wrapper = mount(LegacyEnrichmentRetryReview, { props: { libraryId: 1 } }); wrappers.push(wrapper); return wrapper }
async function open(wrapper) { await button(wrapper, 'Review interrupted lookups').trigger('click'); await flushPromises() }
async function submit(wrapper) { await wrapper.get('input').setValue(true); await button(wrapper, 'Recover reviewed lookups').trigger('click'); await flushPromises() }
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear()
  mocks.preview.mockResolvedValue(structuredClone(preview))
  mocks.confirm.mockImplementation(async (_id, body) => ({ data: { receipt: receipt(body.requestId) } }))
  mocks.receipt.mockResolvedValue({ receipt: null })
})
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); wrappers = []; vi.unstubAllGlobals() })
it('fetches only on demand, escapes titles, shows exact counts and requires explicit labeled attestation', async () => {
  const wrapper = fixture(); await flushPromises()
  expect(mocks.preview).not.toHaveBeenCalled()
  await open(wrapper)
  expect(wrapper.text()).toContain('1 to requeue · 1 at their attempt limit')
  expect(wrapper.text()).toContain('More records remain')
  expect(wrapper.get('caption').text()).toBe('Exact batch to recover')
  expect(wrapper.findAll('th[scope=col]')).toHaveLength(4)
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.get('label').text()).toContain('will remain stopped')
  expect(button(wrapper, 'Recover reviewed lookups').attributes('disabled')).toBeDefined()
  await submit(wrapper)
  expect(mocks.confirm).toHaveBeenCalledWith(1, { workersStopped: true, requestId: expect.any(String) }, '"revision"')
  expect(wrapper.get('[role=status]').text()).toContain('Receipt #42')
  expect(wrapper.text()).toContain('recorded, not finished')
  expect(localStorage.length).toBe(0)
})
it.each([400, 401, 403, 404, 409, 412, 428, 429])('requires fresh review after rejection %s', async status => {
  mocks.confirm.mockRejectedValueOnce({ response: { status } })
  const wrapper = fixture(); await open(wrapper); await submit(wrapper)
  expect(wrapper.get('[role=alert]').text()).toContain('Refresh and review again')
  expect(wrapper.get('input').element.checked).toBe(false)
  await wrapper.get('input').setValue(true)
  expect(button(wrapper, 'Recover reviewed lookups').attributes('disabled')).toBeDefined()
  await button(wrapper, 'Refresh retry review').trigger('click'); await flushPromises()
  expect(wrapper.get('input').element.checked).toBe(false)
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
})
it('uses receipt lookup after a lost response and never invents success from an absent receipt', async () => {
  mocks.confirm.mockRejectedValueOnce(new Error('lost reply'))
  const wrapper = fixture(); await open(wrapper); await submit(wrapper)
  expect(wrapper.get('[role=alert]').text()).toContain('Outcome unverified')
  expect(button(wrapper, 'Refresh retry review').attributes('disabled')).toBeDefined()
  const requestId = mocks.confirm.mock.calls[0][1].requestId
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('does not prove failure')
  mocks.receipt.mockRejectedValueOnce(new Error('offline'))
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('original outcome is still unverified')
  mocks.receipt.mockResolvedValueOnce({ receipt: receipt(requestId, 43) })
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(mocks.receipt).toHaveBeenCalledWith(1, requestId)
  expect(mocks.confirm).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('Receipt #43')
})
it('retries the original confirmation and preserves uncertainty if that retry is rejected', async () => {
  mocks.confirm.mockRejectedValueOnce(new Error('lost reply')).mockRejectedValueOnce({ response: { status: 412 } })
  const wrapper = fixture(); await open(wrapper); await submit(wrapper)
  await button(wrapper, 'Retry same confirmation').trigger('click'); await flushPromises()
  expect(mocks.confirm.mock.calls[1]).toEqual(mocks.confirm.mock.calls[0])
  expect(wrapper.text()).toContain('Outcome unverified')
  expect(wrapper.text()).not.toContain('Confirmation was rejected')
  await button(wrapper, 'Retry same confirmation').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Receipt #42')
})
it.each(['missing', 'request', 'library', 'count', 'audit', 'time'])('retains the request when a %s receipt is malformed or mismatched', async field => {
  mocks.confirm.mockImplementationOnce(async (_id, body) => {
    const recorded = receipt(body.requestId)
    if (field === 'request') recorded.requestId = 'another-request'
    if (field === 'library') recorded.libraryId = 2
    if (field === 'count') recorded.queued = 10
    if (field === 'audit') recorded.auditId = -1
    if (field === 'time') recorded.confirmedAt = 'invalid'
    return { data: { receipt: field === 'missing' ? null : recorded } }
  })
  const wrapper = fixture(); await open(wrapper); await submit(wrapper)
  expect(wrapper.text()).toContain('Outcome unverified')
  expect(wrapper.text()).not.toContain('Receipt #')
  const requestId = mocks.confirm.mock.calls[0][1].requestId
  mocks.receipt.mockResolvedValueOnce({ receipt: { ...receipt(requestId), queued: -1 } })
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('original outcome is still unverified')
  mocks.receipt.mockResolvedValueOnce({ receipt: receipt(requestId) })
  await button(wrapper, 'Check recorded outcome').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Receipt #42')
})
it('ignores a late confirmation after leaving and returning to the same library', async () => {
  const delayed = Promise.withResolvers(); mocks.confirm.mockReturnValueOnce(delayed.promise)
  const wrapper = fixture(); await open(wrapper); await submit(wrapper)
  await wrapper.setProps({ libraryId: 2 }); await wrapper.setProps({ libraryId: 1 })
  delayed.resolve({ data: { receipt: { auditId: 99 } } }); await flushPromises()
  expect(wrapper.text()).not.toContain('Receipt #99')
  expect(wrapper.find('table').exists()).toBe(false)
})
it('clears approval on refresh, fails closed on a failed preview and handles absent browser crypto', async () => {
  const wrapper = fixture(); await open(wrapper)
  await wrapper.get('input').setValue(true)
  mocks.preview.mockRejectedValueOnce(new Error('unavailable'))
  await button(wrapper, 'Refresh retry review').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('Sign in as an administrator')
  expect(wrapper.find('input').exists()).toBe(false)
  await button(wrapper, 'Refresh retry review').trigger('click'); await flushPromises()
  vi.stubGlobal('crypto', {})
  await submit(wrapper)
  expect(wrapper.text()).toContain('No confirmation was sent')
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it.each(['not_needed', 'library_archived', 'unsupported_library', 'unknown'])('has no mutation control for %s', async reason => {
  mocks.preview.mockResolvedValueOnce({ ...preview, canRecover: false, reason, items: [] })
  const wrapper = fixture(); await open(wrapper)
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.find('table').exists()).toBe(false)
  expect(wrapper.find('[role=status]').exists()).toBe(true)
})
it('explains disabled-library waiting without changing settings', async () => {
  mocks.preview.mockResolvedValueOnce({ ...preview, hasMore: false, library: { id: 1, enabled: false } })
  const wrapper = fixture(); await open(wrapper)
  expect(wrapper.text()).toContain('waits until you enable it')
  expect(mocks.confirm).not.toHaveBeenCalled()
})
