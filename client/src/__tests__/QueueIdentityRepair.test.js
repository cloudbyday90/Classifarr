/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QueueIdentityRepair from '../components/command-center/QueueIdentityRepair.vue'
import { queueIdentityRepairError } from '../utils/queueIdentityRepairPresentation'
import { getQueueIdentityRepair, previewQueueIdentityRepair, confirmQueueIdentityRepair, retryQueueIdentityRepair } from '../api/queueTasksApi'

vi.mock('../api/queueTasksApi', () => ({ getQueueIdentityRepair: vi.fn(), previewQueueIdentityRepair: vi.fn(),
  confirmQueueIdentityRepair: vi.fn(), retryQueueIdentityRepair: vi.fn() }))
const task = { id: 23, status: 'failed', attempts: 1, payload: { tmdb_id: 42, media_type: 'movie' } }
const preview = { previewId: 'preview', oldTmdbId: 42, mediaType: 'movie', candidate: {
  tmdbId: 99, title: '<script>Candidate</script>', releaseDate: '2026-01-01', overview: 'An edition' } }
const receipt = { id: 'preview', oldTmdbId: 42, newTmdbId: 99, mediaType: 'movie', confirmedAt: '2026-10-13', retriedAt: null }
const render = (props = {}) => mount(QueueIdentityRepair, { props: { task, canPreview: true, ...props } })
const click = async (w, text) => { await w.findAll('button').find(b => b.text() === text).trigger('click'); await flushPromises() }
beforeEach(() => {
  vi.resetAllMocks()
  getQueueIdentityRepair.mockResolvedValue({ receipt: null })
  previewQueueIdentityRepair.mockResolvedValue({ data: preview })
  confirmQueueIdentityRepair.mockResolvedValue({ data: { receipt } })
  retryQueueIdentityRepair.mockResolvedValue({ data: { receipt: { ...receipt, retriedAt: '2026-10-14' } } })
})

test.each([
  ['queue_identity_repair_unsupported', 'request format'],
  ['queue_identity_repair_budget', 'retry budget'],
  ['queue_identity_repair_prior_work', 'Queue and History'],
])('known refusal %s gives specific guidance', (code, text) => {
  expect(queueIdentityRepairError('preview', 409, code)).toContain(text)
})
test.each(['__proto__', 'constructor', '<script>secret</script>'])('unknown reason %s is not reflected', code => {
  expect(queueIdentityRepairError('receipt', 500, code)).not.toContain(code)
})

test('render does no I/O; preview, checked consent, save and retry are separate actions', async () => {
  const w = render()
  expect(previewQueueIdentityRepair).not.toHaveBeenCalled()
  expect(getQueueIdentityRepair).not.toHaveBeenCalled()
  await click(w, 'Review replacement ID')
  expect(w.text()).toContain('Replace TMDb movie ID 42 with 99?')
  expect(w.find('script').exists()).toBe(false)
  expect(w.findAll('button').find(b => b.text() === 'Save reviewed replacement').attributes('disabled')).toBeDefined()
  await w.get('form').trigger('submit'); await flushPromises()
  expect(confirmQueueIdentityRepair).not.toHaveBeenCalled()
  await w.get('input').setValue(true)
  await w.get('form').trigger('submit'); await flushPromises()
  expect(confirmQueueIdentityRepair).toHaveBeenCalledWith(23, { previewId: 'preview', sameWorkAndEdition: true }, { signal: expect.any(AbortSignal) })
  expect(retryQueueIdentityRepair).not.toHaveBeenCalled()
  expect(w.text()).toContain('Nothing has been retried')
  await click(w, 'Retry using reviewed ID')
  expect(retryQueueIdentityRepair).toHaveBeenCalledWith(23, { receiptId: 'preview' }, { signal: expect.any(AbortSignal) })
  expect(w.text()).toContain('not proof classification finished')
  expect(w.text()).not.toContain('Retry using reviewed ID')
  w.unmount()
})

test('lost confirmation response offers a read-only receipt check, never an automatic repeat', async () => {
  confirmQueueIdentityRepair.mockRejectedValue(new Error('private-secret'))
  const w = render()
  await click(w, 'Review replacement ID'); await w.get('input').setValue(true)
  await w.get('form').trigger('submit'); await flushPromises()
  expect(w.get('[role="alert"]').text()).toContain('lost response may still have committed')
  expect(w.text()).not.toContain('private-secret')
  expect(w.find('form').exists()).toBe(false)
  getQueueIdentityRepair.mockResolvedValue({ receipt })
  await click(w, 'Check saved repair')
  expect(w.text()).toContain('Saved repair: TMDb 42 → 99')
  expect(confirmQueueIdentityRepair).toHaveBeenCalledTimes(1)
  expect(retryQueueIdentityRepair).not.toHaveBeenCalled()
  w.unmount()
})

test.each([[403, 'administrator'], [429, 'Wait a minute'], [409, 'Evidence may be missing'], [500, 'unavailable']])('preview HTTP %s is sanitized', async (status, text) => {
  previewQueueIdentityRepair.mockRejectedValue({ response: { status, data: { error: 'secret' } } })
  const w = render(); await click(w, 'Review replacement ID')
  expect(w.get('[role="alert"]').text()).toContain(text)
  expect(w.text()).not.toContain('secret'); w.unmount()
})

test('saved task marker provides receipt lookup after reload without automatic network requests', async () => {
  const w = render({ task: { ...task, payload: { ...task.payload, identity_repair: 'preview' } } })
  expect(w.text()).not.toContain('Review replacement ID')
  expect(w.text()).toContain('Retry All does not include it')
  await click(w, 'Check saved repair')
  expect(w.text()).toContain('No saved repair was observed')
  expect(retryQueueIdentityRepair).not.toHaveBeenCalled(); w.unmount()
})

test('changed task and unmount cancel pending reads and ignore late responses', async () => {
  let finish
  previewQueueIdentityRepair.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const w = render(); await click(w, 'Review replacement ID')
  const signal = previewQueueIdentityRepair.mock.calls[0][1].signal
  await w.setProps({ task: { ...task, attempts: 2 } })
  expect(signal.aborted).toBe(true)
  finish({ data: preview }); await flushPromises()
  expect(w.find('form').exists()).toBe(false)
  await click(w, 'Review replacement ID')
  const lastSignal = previewQueueIdentityRepair.mock.calls[1][1].signal
  w.unmount(); expect(lastSignal.aborted).toBe(true)
})

test('lost retry response does not offer a second write after saved receipt recovery', async () => {
  getQueueIdentityRepair.mockResolvedValue({ receipt })
  retryQueueIdentityRepair.mockRejectedValue(new Error('offline'))
  const w = render(); await click(w, 'Check saved repair'); await click(w, 'Retry using reviewed ID')
  expect(w.get('[role="alert"]').text()).toContain('Check saved repair')
  getQueueIdentityRepair.mockResolvedValue({ receipt: { ...receipt, retriedAt: '2026-10-14' } })
  await click(w, 'Check saved repair')
  expect(w.text()).not.toContain('Retry using reviewed ID')
  expect(retryQueueIdentityRepair).toHaveBeenCalledTimes(1); w.unmount()
})
