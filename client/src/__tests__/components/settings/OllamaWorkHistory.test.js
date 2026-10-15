/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import api from '@/api'
import OllamaWorkHistory from '@/components/settings/OllamaWorkHistory.vue'
vi.mock('@/api', () => ({ default: { getOllamaWorkHistory: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
const item = (state, source = null) => ({ requestId: state, admittedAt: '2026-10-15T22:00:00.000Z', gatewayAttempt: '1', model: 'synthetic:latest', operation: '/api/generate', source,
  outcome: { state, recordedAt: null, httpStatus: null } })
const result = (items = [], nextBefore = null) => ({ state: 'available', installation: 'local', items, nextBefore })

it('does not load on mount and distinguishes disabled from empty history', async () => {
  const wrapper = mount(OllamaWorkHistory)
  expect(api.getOllamaWorkHistory).not.toHaveBeenCalled()
  api.getOllamaWorkHistory.mockResolvedValue({ state: 'not_configured' })
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).toContain('optional gateway is not configured')
  api.getOllamaWorkHistory.mockResolvedValue(result())
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).toContain('No recorded requests')
})
it('renders outcomes and correlation without inventing success or exposing arbitrary fields', async () => {
  api.getOllamaWorkHistory.mockResolvedValue(result([
    { ...item('response_completed', { taskId: '42', taskType: 'classification', attempt: 2 }), outcome: { state: 'response_completed', recordedAt: '2026-10-15T22:00:01.000Z', httpStatus: 200 }, prompt: 'PRIVATE' },
    item('active_or_uncertain'), { ...item('outcome_not_recorded'), model: null, operation: null },
    { ...item('provider_rejected'), operation: '/api/embed' }, item('not_dispatched'), item('completion_observed'), item('abandoned_after_review'), item('unexpected'),
  ]))
  const wrapper = mount(OllamaWorkHistory); await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).toContain('Task 42'); expect(wrapper.text()).toContain('Active or outcome uncertain')
  expect(wrapper.text()).toContain('Outcome not recorded'); expect(wrapper.text()).toContain('No task reference recorded')
  expect(wrapper.text()).not.toContain('PRIVATE'); expect(wrapper.findAll('button')).toHaveLength(1)
})
it('keeps older pages tied to the applied filter, not unsubmitted input', async () => {
  api.getOllamaWorkHistory.mockResolvedValueOnce(result([item('completion_observed')], '10')).mockResolvedValue(result())
  const wrapper = mount(OllamaWorkHistory); await wrapper.get('input').setValue('42'); await wrapper.get('form').trigger('submit'); await flushPromises()
  await wrapper.get('input').setValue('99'); await wrapper.findAll('button').at(-1).trigger('click'); await flushPromises()
  expect(api.getOllamaWorkHistory).toHaveBeenLastCalledWith({ taskId: '42', before: '10' }, expect.any(AbortSignal))
})
it.each(['0','1.5','9223372036854775808','no'])('rejects invalid task filter %s locally', async value => {
  const wrapper = mount(OllamaWorkHistory); await wrapper.get('input').setValue(value); await wrapper.get('form').trigger('submit')
  expect(wrapper.get('[role="alert"]').text()).toBe('Enter a positive queue task ID.'); expect(api.getOllamaWorkHistory).not.toHaveBeenCalled()
})
it('announces failure without leaking transport details', async () => {
  api.getOllamaWorkHistory.mockRejectedValue(new Error('PRIVATE'))
  const wrapper = mount(OllamaWorkHistory); await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Gateway history is unavailable'); expect(wrapper.text()).not.toContain('PRIVATE')
})
it('cancels on unmount and ignores a late response', async () => {
  let resolve
  api.getOllamaWorkHistory.mockImplementation(() => new Promise(done => { resolve = done }))
  const wrapper = mount(OllamaWorkHistory); await wrapper.get('form').trigger('submit')
  expect(wrapper.text()).toContain('Loading gateway history'); const signal = api.getOllamaWorkHistory.mock.calls[0][1]
  wrapper.unmount(); expect(signal.aborted).toBe(true); resolve(result()); await flushPromises()
})
