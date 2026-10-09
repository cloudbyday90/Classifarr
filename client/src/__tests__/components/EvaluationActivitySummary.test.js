/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EvaluationActivitySummary from '@/components/command-center/EvaluationActivitySummary.vue'
import { normalizeEvaluationActivity, evaluationPolicyStatus } from '@/utils/evaluationActivity'

import { evaluationActivityFixture as fixture } from '../fixtures/evaluationActivity'

it('shows policy work without implying AI calls, routing or accuracy', () => {
  const wrapper = mount(EvaluationActivitySummary, { props: { activity: normalizeEvaluationActivity(fixture()) } })
  expect(wrapper.text()).toContain('300 cases evaluated by policy replay')
  expect(wrapper.text()).toContain('40 automatic · 37 review · 223 manual · 0 unavailable')
  expect(wrapper.text()).toContain('No AI calls were needed')
  expect(wrapper.text()).toContain('not media moved or an accuracy score')
  expect(wrapper.text()).toContain('Disabled — no AI calls are scheduled')
  expect(wrapper.text()).toContain('does not repair unsupported comparison paths')
  expect(wrapper.findAll('button')).toHaveLength(0)
  expect(wrapper.find('[aria-live]').exists()).toBe(false)
})

it.each(Object.keys(evaluationPolicyStatus))('shows explicit non-success policy state %s', status => {
  const value = fixture(); value.policy = { status, observedAt: status === 'never_run' ? null : value.checkedAt, counts: null }
  const wrapper = mount(EvaluationActivitySummary, { props: { activity: normalizeEvaluationActivity(value) } })
  expect(wrapper.text()).toContain(evaluationPolicyStatus[status])
  expect(wrapper.text()).not.toContain('300 cases evaluated')
})

it('distinguishes configured capture, old reservations and unknown or legacy configuration', () => {
  const value = fixture()
  value.capture = { enabled: true, dailyCalls: 5, dailyTokens: 42240, quotaDay: '2026-10-08', callsReserved: 5, tokensReserved: 42240, lastOutcome: 'budget_exhausted' }
  const wrapper = mount(EvaluationActivitySummary, { props: { activity: normalizeEvaluationActivity(value) } })
  expect(wrapper.text()).toContain('Budget configured: 5 calls and 42240 tokens')
  expect(wrapper.text()).toContain('Reservations for 2026-10-08')
  expect(wrapper.text()).toContain('Reservations are not measured usage')
  expect(wrapper.text()).toContain('quota exhausted')
  expect(wrapper.text()).not.toContain('Disabled —')
  value.capture = { enabled: null, dailyCalls: null, dailyTokens: null, quotaDay: null, callsReserved: null, tokensReserved: null, lastOutcome: 'unknown' }
  expect(mount(EvaluationActivitySummary, { props: { activity: normalizeEvaluationActivity(value) } }).text()).toContain('configuration is unknown')
  const legacy = mount(EvaluationActivitySummary)
  expect(legacy.text()).toContain('not available from this server')
  expect(legacy.findComponent({ name: 'EvaluationCaptureHelp' }).exists()).toBe(false)
})

it('rejects malformed or contradictory aggregates and strips unrelated fields', () => {
  for (const mutate of [v => { v.checkedAt = 'bad' }, v => { v.policy = null },
    v => { v.policy.observedAt = null }, v => { v.policy.observedAt = '2026-10-09T11:45:00Z' },
    v => { v.policy.observedAt = '2026-10-09T12:01:00Z' }, v => { v.policy.counts.cases = 301 },
    v => { v.policy.counts.paired = 1 }, v => { v.policy.counts.baseline.manual = 1 },
    v => { v.policy.status = 'failed' }, v => { v.capture = null }, v => { v.capture.lastOutcome = 'PRIVATE' },
    v => { v.capture.enabled = null }, v => { v.capture.enabled = true }, v => { v.capture.dailyCalls = '0' },
    v => { v.capture.dailyCalls = 201 }, v => { v.capture.callsReserved = 1 },
    v => { v.capture.quotaDay = '2026-02-30' }, v => { v.capture.quotaDay = 'bad' }]) {
    const value = fixture(); mutate(value); expect(normalizeEvaluationActivity(value)).toBeNull()
  }
  expect(normalizeEvaluationActivity(null)).toBeNull()
  const value = fixture(); value.private = 'PRIVATE'; value.policy.counts.baseline.secret = 'PRIVATE'; value.capture.endpoint = 'PRIVATE'
  expect(JSON.stringify(normalizeEvaluationActivity(value))).not.toContain('PRIVATE')
})
