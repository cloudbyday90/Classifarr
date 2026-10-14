/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EvaluationWorkloadControls from '@/components/command-center/EvaluationWorkloadControls.vue'
import { readEvaluationWorkload, workloadMinute, workloadTime } from '@/utils/evaluationWorkload'
const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/api/evaluationHistoryApi', () => ({ getEvaluationWorkload: get, updateEvaluationWorkload: put }))
const fixture = () => ({ version: 'evaluation_workload.v1', revision: 0, mode: 'off', dailyRequests: 0,
  startMinute: null, endMinute: null, quotaDay: '2026-10-14', requestsReserved: 2, scope: 'installation', timezone: 'UTC' })
beforeEach(() => { vi.clearAllMocks(); get.mockResolvedValue(fixture()) })
const opened = async () => {
  const wrapper = mount(EvaluationWorkloadControls)
  await wrapper.find('button').trigger('click'); await flushPromises(); return wrapper
}
it('opening status never enables inference or saves defaults', async () => {
  const wrapper = mount(EvaluationWorkloadControls)
  expect(get).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled()
  wrapper.find('details').element.open = true
  await wrapper.find('details').trigger('toggle'); await flushPromises()
  expect(get).toHaveBeenCalledTimes(1); expect(put).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('Saved mode: Off')
  expect(wrapper.text()).toContain('this installation only')
  expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite')
})
it('saves explicit idle and overnight UTC modes using the loaded revision', async () => {
  const wrapper = await opened()
  await wrapper.find('select').setValue('scheduled')
  await wrapper.find('input[type="number"]').setValue('10')
  await wrapper.findAll('input[type="time"]')[0].setValue('23:00')
  await wrapper.findAll('input[type="time"]')[1].setValue('02:00')
  put.mockResolvedValue({ data: { ...fixture(), revision: 1, mode: 'scheduled', dailyRequests: 10, startMinute: 1380, endMinute: 120 } })
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(put).toHaveBeenLastCalledWith({ revision: 0, mode: 'scheduled', dailyRequests: 10, startMinute: 1380, endMinute: 120 })
  expect(wrapper.text()).toContain('Saved mode: Scheduled')
  await wrapper.find('select').setValue('when_idle')
  put.mockResolvedValue({ data: { ...fixture(), revision: 2, mode: 'when_idle', dailyRequests: 10 } })
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(put).toHaveBeenLastCalledWith({ revision: 1, mode: 'when_idle', dailyRequests: 10, startMinute: null, endMinute: null })
  await wrapper.find('select').setValue('off')
  put.mockResolvedValue({ data: { ...fixture(), revision: 3 } })
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(put).toHaveBeenLastCalledWith({ revision: 2, mode: 'off', dailyRequests: 0, startMinute: null, endMinute: null })
  expect(wrapper.text()).toContain('Requests reserved for 2026-10-14 (UTC): 2')
})
it('rejects invalid limits and equal times before saving', async () => {
  const wrapper = await opened()
  await wrapper.find('select').setValue('when_idle')
  await wrapper.find('input[type="number"]').setValue('201')
  await wrapper.find('form').trigger('submit')
  expect(wrapper.text()).toContain('from 1 to 200')
  await wrapper.find('select').setValue('scheduled')
  await wrapper.findAll('input[type="time"]')[1].setValue('00:00')
  await wrapper.find('form').trigger('submit')
  expect(wrapper.text()).toContain('different, valid start and end times')
  expect(put).not.toHaveBeenCalled()
})
it.each([409, 503])('requires read-back after conflicting or uncertain save (%s)', async status => {
  const wrapper = await opened()
  put.mockRejectedValue({ response: { status }, message: 'PRIVATE' })
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(wrapper.text()).toContain('Refresh'); expect(wrapper.text()).not.toContain('PRIVATE')
  expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
  await wrapper.find('form').trigger('submit'); expect(put).toHaveBeenCalledTimes(1)
  await wrapper.find('button').trigger('click'); await flushPromises()
  expect(wrapper.find('fieldset').attributes('disabled')).toBeUndefined()
})
it('invalid/failed reads never fabricate Off and unmount ignores late responses', async () => {
  get.mockResolvedValue({ ...fixture(), mode: 'unknown' })
  const wrapper = await opened()
  expect(wrapper.find('form').exists()).toBe(false)
  expect(wrapper.text()).toContain('Settings are unavailable')
  let resolve
  get.mockReturnValue(new Promise(done => { resolve = done }))
  await wrapper.find('button').trigger('click'); wrapper.unmount()
  resolve(fixture()); await flushPromises(); expect(put).not.toHaveBeenCalled()
})
it('strict projection and time helpers reject unknown or private payloads', () => {
  expect(readEvaluationWorkload({ ...fixture(), secret: 'PRIVATE' })).not.toHaveProperty('secret')
  for (const delta of [{ dailyRequests: -1 }, { revision: -1 }, { requestsReserved: 201 }, { scope: 'global' },
    { timezone: 'local' }, { mode: '__proto__' }, { dailyRequests: 5 }, { mode: 'scheduled', dailyRequests: 5, startMinute: 0, endMinute: 0 }]) {
    expect(readEvaluationWorkload({ ...fixture(), ...delta })).toBeNull()
  }
  expect(readEvaluationWorkload(null)).toBeNull()
  expect(workloadTime(1439)).toBe('23:59'); expect(workloadTime(null)).toBe('')
  expect(workloadMinute('23:59')).toBe(1439); expect(workloadMinute('24:00')).toBeNull()
})
