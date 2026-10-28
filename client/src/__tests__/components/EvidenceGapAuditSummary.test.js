/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import EvidenceGapAuditSummary from '@/components/command-center/EvidenceGapAuditSummary.vue'
import { useEvidenceGapAudit } from '@/composables/useEvidenceGapAudit'
import { normalizeEvidenceGapAudit } from '@/utils/evidenceGapAudit'
import { evidenceGapAuditFixture } from '../fixtures/evidenceGapAudit'
import api from '@/api'
vi.mock('@/api', () => ({ default: { getEvidenceGapAudit: vi.fn() } }))
const network = vi.hoisted(() => ({ online: null }))
vi.mock('@vueuse/core', () => ({ useOnline: () => network.online }))
let wrapper, paused, enabled, steady
function mountAudit() {
  paused = ref(false); enabled = ref(true); steady = 0
  wrapper = mount({ components: { EvidenceGapAuditSummary }, setup: () => ({
    ...useEvidenceGapAudit({ paused, enabled, steadyNow: () => steady }), paused }),
  template: '<EvidenceGapAuditSummary v-if="available" :audit="snapshot" :paused="paused" :loading="isLoading" :error-message="errorMessage" />' })
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); network.online = ref(true)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getEvidenceGapAudit.mockResolvedValue(evidenceGapAuditFixture())
})
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); vi.restoreAllMocks() })

it('keeps reasons collapsed with a quiet live status, preserves disclosure focus and clears failed counts', async () => {
  mountAudit(); await flushPromises()
  expect(wrapper.text()).toContain('historical recovery is not assessed')
  expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
  const details = wrapper.get('details').element; details.open = true
  paused.value = true
  api.getEvidenceGapAudit.mockRejectedValue(new Error('PRIVATE payload'))
  await vi.advanceTimersByTimeAsync(300000)
  expect(wrapper.get('details').element).toBe(details); expect(details.open).toBe(true)
  expect(wrapper.find('dl').exists()).toBe(false)
  expect(wrapper.text()).toContain('unavailable')
  expect(JSON.stringify(console.error.mock.calls)).not.toContain('PRIVATE')
  expect(localStorage.getItem('classifarr:v1:swr:evidence-gap-audit')).toBeNull()
})
it('uses the original monotonic request anchor through proxying, pause, hidden time and resume', async () => {
  mountAudit(); await flushPromises(); paused.value = true
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  steady = 16 * 60000
  await vi.advanceTimersByTimeAsync(16 * 60000)
  expect(wrapper.find('dl').exists()).toBe(false)
  paused.value = false; await flushPromises()
  expect(wrapper.find('dl').exists()).toBe(false)
  expect(wrapper.text()).toContain('stale')
  expect(api.getEvidenceGapAudit).toHaveBeenCalledTimes(1)
})
it('includes request latency in freshness and rejects invalid private payloads', async () => {
  let finish; api.getEvidenceGapAudit.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  mountAudit(); steady = 16 * 60000; finish(evidenceGapAuditFixture()); await flushPromises()
  expect(wrapper.find('dl').exists()).toBe(false)
  expect(wrapper.text()).toContain('stale')
})
it.each([401, 403])('clears access and stops further polling after %s', async status => {
  mountAudit(); await flushPromises()
  api.getEvidenceGapAudit.mockRejectedValue({ response: { status } })
  await vi.advanceTimersByTimeAsync(300000)
  expect(wrapper.find('section').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(600000)
  expect(api.getEvidenceGapAudit).toHaveBeenCalledTimes(2)
})
it('discards an in-flight response when the containing administrator view loses access', async () => {
  let finish; api.getEvidenceGapAudit.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  mountAudit(); enabled.value = false; await flushPromises(); finish(evidenceGapAuditFixture()); await flushPromises()
  expect(wrapper.find('section').exists()).toBe(false)
})
it('validates counts, exact fields, temporal bounds and conservative eligibility flags', () => {
  expect(normalizeEvidenceGapAudit(evidenceGapAuditFixture())).not.toBeNull()
  for (const mutate of [v => { v.private = 'PRIVATE' }, v => { v.report.comparisons.eligible = 1 },
    v => { v.report.limits.historicalRecovery = 'recoverable' }, v => { v.report.limits.providerCalls = 1 },
    v => { v.report.observations.reasons.sourceOnlyRows = 1 }, v => { v.observedAt = 'bad' },
    v => { v.checkedAt = '2026-10-28T12:15:00.000Z' }, v => { v.report.intake.capped = true },
    v => { v.reason = 'PRIVATE' }, v => { v.report.window.since = v.observedAt }]) {
    const value = evidenceGapAuditFixture(); mutate(value); expect(normalizeEvidenceGapAudit(value)).toBeNull()
  }
  const capped = evidenceGapAuditFixture(); Object.assign(capped.report.intake, {
    recordedMovieTvEvents: 5001, capped: true, withoutRetainedComparison: null })
  capped.report.evidencePhase = 'awaiting_live_comparisons'
  expect(normalizeEvidenceGapAudit(capped)).not.toBeNull()
})
