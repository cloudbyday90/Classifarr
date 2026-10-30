/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import api from '@/api'
import PurposeEvaluationSummary from '@/components/command-center/PurposeEvaluationSummary.vue'
import { usePurposeEvaluation } from '@/composables/usePurposeEvaluation'
import { normalizePurposeEvaluation } from '@/utils/purposeEvaluation'
import { purposeEvaluationFixture } from '../fixtures/purposeEvaluation'
vi.mock('@/api', () => ({ default: { getPurposeEvaluation: vi.fn() } }))
let wrapper, paused, enabled, steady
const mountSummary = () => {
  paused = ref(false); enabled = ref(true); steady = 0
  wrapper = mount({ components: { PurposeEvaluationSummary }, setup: () => ({
    ...usePurposeEvaluation({ paused, enabled, steadyNow: () => steady }), paused }),
  template: '<PurposeEvaluationSummary v-if="available" :summary="snapshot" :loading="isLoading" :paused="paused" :error-message="errorMessage" />' })
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T12:00:00.000Z')); api.getPurposeEvaluation.mockReset(); api.getPurposeEvaluation.mockResolvedValue(purposeEvaluationFixture()) })
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers() })

it('shows one quiet automatic summary with native expansion and no trigger controls', async () => {
  mountSummary(); await flushPromises()
  expect(wrapper.text()).toContain('Destination reviews: 1 comparable choice; 1 differs from the policy recommendation.')
  expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite')
  expect(wrapper.find('details').attributes('open')).toBeUndefined()
  expect(wrapper.find('summary').text()).toBe('Destination review details')
  expect(wrapper.find('button').exists()).toBe(false)
  expect(wrapper.text()).not.toMatch(/CLI|run command|classificationId|fingerprint/)
  expect(wrapper.text()).toContain('Unknown: 1')
})
it('polls saved status automatically and withholds monotonically stale counts while paused', async () => {
  mountSummary(); await flushPromises(); paused.value = true; steady = 16 * 60000
  await vi.advanceTimersByTimeAsync(30000); await flushPromises()
  expect(wrapper.text()).toContain('out of date')
  expect(wrapper.text()).not.toContain('1 comparable choice')
  await vi.advanceTimersByTimeAsync(300000); expect(api.getPurposeEvaluation.mock.calls.length).toBeGreaterThan(1)
})
it('never renders private transport text or treats failure as zero', async () => {
  api.getPurposeEvaluation.mockRejectedValue(new Error('PRIVATE token SQL'))
  mountSummary(); await flushPromises()
  expect(wrapper.text()).toContain('will retry automatically')
  expect(wrapper.text()).not.toMatch(/PRIVATE|0 comparable/)
})
it.each([401, 403])('clears counts and stops polling after %s', async status => {
  api.getPurposeEvaluation.mockRejectedValue({ response: { status } }); mountSummary(); await flushPromises()
  expect(wrapper.find('section').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(600000); expect(api.getPurposeEvaluation).toHaveBeenCalledTimes(1)
})
it('clears an in-flight response when authorization is lost', async () => {
  let finish; api.getPurposeEvaluation.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  mountSummary(); enabled.value = false; await flushPromises(); finish(purposeEvaluationFixture()); await flushPromises()
  expect(wrapper.find('section').exists()).toBe(false)
})
it('shows an empty retained window as waiting rather than readiness or accuracy', async () => {
  api.getPurposeEvaluation.mockResolvedValue(purposeEvaluationFixture(0)); mountSummary(); await flushPromises()
  expect(wrapper.find('[role="status"]').text()).toContain('once recorded choices are available')
  expect(wrapper.text()).toContain('An empty window only means no retained destination choices were available')
})
it.each([
  ['never_run', null, 'Waiting for the first saved summary'],
  ['unavailable', 'sources_unavailable', 'evidence is not available'],
  ['deferred', 'memory_pressure', 'waiting for background capacity'],
  ['failed', 'deadline', 'will retry automatically'],
  ['stale', null, 'out of date'],
])('shows precise %s state with no stale counts', async (status, reason, text) => {
  const value = purposeEvaluationFixture(); Object.assign(value, { status, reason, report: null })
  if (status === 'never_run') Object.assign(value, { observedAt: null, nextCheckAt: null })
  if (status === 'stale') value.checkedAt = '2026-10-29T12:15:00.000Z'
  api.getPurposeEvaluation.mockResolvedValue(value); mountSummary(); await flushPromises()
  expect(wrapper.find('[role="status"]').text()).toContain(text)
  expect(wrapper.find('dl').exists()).toBe(false)
})
describe('closed saved-status contract', () => {
  it('accepts the valid aggregate without changing it', () => expect(normalizePurposeEvaluation(purposeEvaluationFixture())).not.toBeNull())
  it.each([
    value => { value.report.private = 'PRIVATE' }, value => { value.report.eligible = 0 },
    value => { value.report.limits.producerReadiness = 'ready' }, value => { value.report.sources.manual.eligible = 2 },
    value => { value.status = 'failed' }, value => { value.nextCheckAt = '2026-10-29T15:00:00.000Z' },
  ])('rejects malformed, private and inconsistent data', mutate => {
    const value = purposeEvaluationFixture(); mutate(value); expect(normalizePurposeEvaluation(value)).toBeNull()
  })
  it('distinguishes missing sources from an empty saved report', () => {
    const value = purposeEvaluationFixture(); Object.assign(value, { status: 'unavailable', reason: 'sources_unavailable', report: null })
    expect(normalizePurposeEvaluation(value)).not.toBeNull()
  })
})
