/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import EvaluationHistorySummary from '@/components/command-center/EvaluationHistorySummary.vue'
import { normalizeEvaluationHistory } from '@/utils/evaluationHistorySummary'
import api from '@/api'

vi.mock('@/api', () => ({ default: { getEvaluationHistory: vi.fn() } }))
const network = vi.hoisted(() => ({ online: null }))
vi.mock('@vueuse/core', () => ({ useOnline: () => network.online }))
const group = () => ({ latestAt: '2026-09-25T12:00:00Z', windows: 1, sampled: 60, eligible: 50,
  selected: 25, paired: 20, labeled: 5, gains: 2, regressions: 1, deferralsReduced: 3, deferralsIncreased: 1, moviePaired: 10, tvPaired: 10 })
const report = () => ({ version: 'evaluation_history_summary.v1', retentionDays: 30, windowLimit: 500,
  windows: 1, revisions: 1, groups: [group()], providerCalls: 0, routingWrites: 0, promotionAllowed: false, fullPipelineAccuracy: null })
let wrapper
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); network.online = ref(true)
  localStorage.clear()
  api.getEvaluationHistory.mockResolvedValue(report())
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); vi.restoreAllMocks() })

it('uses nonpersistent SWR with bounded visible polling and collapsed detail, without claiming accuracy', async () => {
  wrapper = mount(EvaluationHistorySummary); await flushPromises()
  expect(wrapper.text()).toContain('20 of 50 eligible items compared')
  expect(wrapper.text()).toContain('15 remain unlabelled')
  expect(wrapper.text()).toContain('This is coverage, not accuracy')
  expect(wrapper.find('details').attributes('open')).toBeUndefined()
  expect(wrapper.find('time').attributes('datetime')).toBe('2026-09-25T12:00:00.000Z')
  expect(localStorage.getItem('classifarr:v1:swr:evaluation-history')).toBeNull()
  await vi.advanceTimersByTimeAsync(300_000)
  expect(api.getEvaluationHistory).toHaveBeenCalledTimes(2)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await vi.advanceTimersByTimeAsync(600_000)
  expect(api.getEvaluationHistory).toHaveBeenCalledTimes(2)
})

it('pauses presentation, resumes latest values and clears even paused snapshots after a failed refresh', async () => {
  wrapper = mount(EvaluationHistorySummary); await flushPromises()
  await wrapper.get('button').trigger('click')
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  const next = report(); next.groups[0].selected = 30; next.groups[0].paired = 25; next.groups[0].moviePaired = 15
  api.getEvaluationHistory.mockResolvedValue(next)
  await vi.advanceTimersByTimeAsync(300_000)
  expect(wrapper.text()).toContain('20 of 50')
  await wrapper.get('button').trigger('click')
  expect(wrapper.text()).toContain('25 of 50')
  await wrapper.get('button').trigger('click')
  api.getEvaluationHistory.mockRejectedValue(new Error('PRIVATE secret'))
  await vi.advanceTimersByTimeAsync(300_000)
  expect(wrapper.text()).not.toContain('25 of 50')
  expect(wrapper.text()).toContain('unavailable')
  expect(JSON.stringify(console.error.mock.calls)).not.toContain('PRIVATE')
})

it.each([401, 403])('hides the summary and stops polling after authorization denial %s', async status => {
  wrapper = mount(EvaluationHistorySummary); await flushPromises()
  await wrapper.get('button').trigger('click')
  api.getEvaluationHistory.mockRejectedValue({ response: { status } })
  await vi.advanceTimersByTimeAsync(300_000)
  expect(wrapper.find('section').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(600_000)
  expect(api.getEvaluationHistory).toHaveBeenCalledTimes(2)
})

it('shows honest empty and earlier-revision states, never a success badge', async () => {
  api.getEvaluationHistory.mockResolvedValue({ ...report(), windows: 0, revisions: 0, groups: [] })
  wrapper = mount(EvaluationHistorySummary); await flushPromises()
  expect(wrapper.text()).toContain('No saved evaluation windows yet')
  const next = report(); next.windows = 2; next.revisions = 2; next.groups.push(group())
  api.getEvaluationHistory.mockResolvedValue(next)
  await vi.advanceTimersByTimeAsync(300_000)
  expect(wrapper.text()).toContain('Earlier revision 1')
  expect(wrapper.text()).toContain('Revisions are not directly comparable')
})

it('rejects malformed responses and strips unknown private fields', async () => {
  for (const mutate of [value => { value.groups[0].paired = 300 }, value => { value.groups[0].latestAt = 'bad' },
    value => { value.providerCalls = 1 }, value => { value.groups[0].gains = 10 }, value => { value.groups[0].tvPaired = 30 },
    value => { value.revisions = 0 }, value => { value.windows = 501 }, value => { value.groups[0] = null }]) {
    const value = report(); mutate(value); expect(normalizeEvaluationHistory(value)).toBeNull()
  }
  const extra = report(); extra.private = 'PRIVATE'; extra.groups[0].private = 'PRIVATE'
  expect(JSON.stringify(normalizeEvaluationHistory(extra))).not.toContain('PRIVATE')
  api.getEvaluationHistory.mockResolvedValue({})
  wrapper = mount(EvaluationHistorySummary); await flushPromises()
  expect(wrapper.text()).toContain('unavailable')
})

it('discards a response after unmount', async () => {
  let finish
  api.getEvaluationHistory.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  wrapper = mount(EvaluationHistorySummary)
  wrapper.unmount(); finish(report()); await flushPromises()
  expect(localStorage.getItem('classifarr:v1:swr:evaluation-history')).toBeNull()
})
