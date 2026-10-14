/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QueueRepairBackfill from '../components/command-center/QueueRepairBackfill.vue'
import { getQueueRepairBackfill, retryQueueRepairBackfill, getQueueIdentityRepair } from '../api/queueTasksApi'
vi.mock('../api/queueTasksApi', () => ({ getQueueRepairBackfill: vi.fn(), retryQueueRepairBackfill: vi.fn(), getQueueIdentityRepair: vi.fn() }))
const item = { taskId: '23', receiptId: 'receipt', title: '<script>Title</script>', oldTmdbId: 42, newTmdbId: 99, mediaType: 'movie', readiness: { status: 'ready', reason: 'ready' } }
const click = async (w, text) => { await w.findAll('button').find(b => b.text() === text).trigger('click'); await flushPromises() }
beforeEach(() => {
  vi.resetAllMocks()
  getQueueRepairBackfill.mockResolvedValue({ items: [item], nextCursor: null })
  retryQueueRepairBackfill.mockResolvedValue({ data: { receipts: [{ id: 'receipt', retriedAt: '2026-10-13' }] } })
  getQueueIdentityRepair.mockResolvedValue({ receipt: { id: 'receipt', retriedAt: '2026-10-13' } })
})
async function select(w) {
  await click(w, 'Load reviewed repairs')
  await w.findAll('input')[0].setValue(true)
  await w.findAll('input').at(-1).setValue(true)
}
test('render is read-only; selection and separate consent are required, then reports only saved enqueue', async () => {
  const w = mount(QueueRepairBackfill)
  expect(getQueueRepairBackfill).not.toHaveBeenCalled()
  await click(w, 'Load reviewed repairs')
  expect(w.find('script').exists()).toBe(false)
  await w.get('form').trigger('submit'); await flushPromises()
  expect(retryQueueRepairBackfill).not.toHaveBeenCalled()
  await w.findAll('input')[0].setValue(true)
  await w.get('form').trigger('submit'); await flushPromises()
  expect(retryQueueRepairBackfill).not.toHaveBeenCalled()
  await w.findAll('input').at(-1).setValue(true)
  await w.get('form').trigger('submit'); await flushPromises()
  expect(retryQueueRepairBackfill).toHaveBeenCalledExactlyOnceWith({ items: [{ taskId: '23', receiptId: 'receipt' }], confirmRetry: true }, { signal: expect.any(AbortSignal) })
  expect(w.text()).toContain('Queued does not mean classification finished')
  expect(w.find('form').exists()).toBe(false)
  w.unmount()
})
test('selection changes revoke consent; page and refresh clear selection; maximum five', async () => {
  getQueueRepairBackfill.mockResolvedValue({ items: Array.from({ length: 6 }, (_, i) => ({ ...item, taskId: `${i + 1}`, receiptId: `r${i}` })), nextCursor: '6' })
  const w = mount(QueueRepairBackfill); await click(w, 'Load reviewed repairs')
  await w.findAll('input').at(-1).setValue(true)
  for (let i = 0; i < 5; i++) await w.findAll('input')[i].setValue(true)
  expect(w.findAll('input').at(-1).element.checked).toBe(false)
  expect(w.findAll('input')[5].attributes('disabled')).toBeDefined()
  await click(w, 'Next page')
  expect(getQueueRepairBackfill).toHaveBeenLastCalledWith({ afterId: '6', signal: expect.any(AbortSignal) })
  expect(w.findAll('input').some(i => i.element.checked)).toBe(false)
  getQueueRepairBackfill.mockResolvedValue({ items: [], nextCursor: null })
  await click(w, 'Load reviewed repairs')
  expect(w.text()).toContain('No reviewed repairs awaiting retry')
  w.unmount()
})
test('lost write response blocks new writes and permits only explicit saved-outcome checks', async () => {
  retryQueueRepairBackfill.mockRejectedValue(new Error('private token'))
  const w = mount(QueueRepairBackfill); await select(w)
  await w.get('form').trigger('submit'); await flushPromises()
  expect(w.text()).not.toContain('private token')
  expect(w.get('fieldset').attributes('disabled')).toBeDefined()
  getQueueIdentityRepair.mockResolvedValueOnce({ receipt: null })
  await click(w, 'Check saved retry outcomes')
  expect(w.text()).toContain('0 of 1 saved retries observed')
  expect(w.text()).toContain('may still be in flight')
  await click(w, 'Check saved retry outcomes')
  expect(w.text()).toContain('1 of 1 saved retries observed')
  expect(retryQueueRepairBackfill).toHaveBeenCalledTimes(1)
  expect(w.find('form').exists()).toBe(false)
  w.unmount()
})
test('known transaction refusal stays actionable, and failed status reads do not echo server errors', async () => {
  const w = mount(QueueRepairBackfill); await select(w)
  retryQueueRepairBackfill.mockRejectedValueOnce({ response: { status: 409, data: { error: 'secret' } } })
  await w.get('form').trigger('submit'); await flushPromises()
  expect(w.text()).toContain('No new retries were queued')
  expect(w.get('fieldset').attributes('disabled')).toBeUndefined()
  retryQueueRepairBackfill.mockRejectedValueOnce(new Error('unknown'))
  await w.get('form').trigger('submit'); await flushPromises()
  getQueueIdentityRepair.mockRejectedValueOnce(new Error('secret'))
  await click(w, 'Check saved retry outcomes')
  expect(w.text()).not.toContain('secret')
  expect(w.get('[role="alert"]').text()).toContain('not confirmed')
  w.unmount()
})
test('load failures are sanitized; pending requests are aborted on unmount', async () => {
  getQueueRepairBackfill.mockRejectedValueOnce(new Error('secret'))
  const w = mount(QueueRepairBackfill); await click(w, 'Load reviewed repairs')
  expect(w.text()).toContain('Could not load reviewed repairs')
  expect(w.text()).not.toContain('secret')
  let finish
  getQueueRepairBackfill.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await click(w, 'Load reviewed repairs')
  const signal = getQueueRepairBackfill.mock.calls.at(-1)[0].signal
  w.unmount(); expect(signal.aborted).toBe(true)
  finish({ items: [item], nextCursor: null }); await flushPromises()
  expect(retryQueueRepairBackfill).not.toHaveBeenCalled()
})

test('blocked, missing and unknown readiness cannot be selected; reasons are accessible and refresh clears consent', async () => {
  const rows = [item,
    { ...item, taskId: '24', receiptId: 'blocked', readiness: { status: 'blocked', reason: 'provider_changed' } },
    { ...item, taskId: '25', receiptId: 'missing', readiness: undefined },
    { ...item, taskId: '26', receiptId: 'unknown', readiness: { status: 'ready', reason: '<script>secret</script>' } },
  ]
  getQueueRepairBackfill.mockResolvedValue({ items: rows, nextCursor: null, checkedAt: '2026-10-13T23:00:00Z' })
  const w = mount(QueueRepairBackfill); await click(w, 'Load reviewed repairs')
  expect(w.get('[role="status"]').text()).toContain('1 of 4 repairs ready')
  expect(w.text()).toContain('not TMDb availability')
  expect(w.text()).toContain('TMDb settings changed since approval')
  expect(w.text()).not.toContain('secret')
  for (const input of w.findAll('input').slice(1, 4)) expect(input.element.disabled).toBe(true)
  for (const input of w.findAll('input').slice(0, 4)) {
    expect(w.findAll('span').some(span => span.attributes('id') === input.attributes('aria-describedby'))).toBe(true)
  }
  await w.findAll('input')[0].setValue(true)
  await w.findAll('input').at(-1).setValue(true)
  getQueueRepairBackfill.mockResolvedValue({ items: [rows[1]], nextCursor: null, checkedAt: 'invalid' })
  await click(w, 'Load reviewed repairs')
  expect(w.text()).toContain('0 of 1 repairs ready')
  expect(w.findAll('input').some(i => i.element.checked)).toBe(false)
  await w.get('form').trigger('submit'); await flushPromises()
  expect(retryQueueRepairBackfill).not.toHaveBeenCalled()
  w.unmount()
})
