/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from 'vitest'
import { isRepairReady, repairReadinessLabel } from '../utils/queueRepairReadiness'

test.each(['provider_unconfigured', 'provider_changed', 'retry_budget_exhausted', 'retry_budget_changed',
  'request_changed', 'request_unsupported', 'identity_conflict', 'identity_invalid',
  'task_ineligible', 'task_missing', 'prior_work'])('fixed reason %s remains blocked', reason => {
  const readiness = { status: 'blocked', reason }
  expect(isRepairReady(readiness)).toBe(false)
  expect(repairReadinessLabel(readiness)).not.toContain('unavailable')
})
test.each([null, undefined, {}, { status: 'ready' }, { status: 'blocked', reason: 'ready' },
  { status: 'ready', reason: 'private secret' }, { status: 'blocked', reason: 'private secret' },
  { status: 'future', reason: 'provider_changed' }])('unknown or inconsistent readiness fails closed: %j', readiness => {
  expect(isRepairReady(readiness)).toBe(false)
  expect(repairReadinessLabel(readiness)).toBe('Readiness is unavailable. Reload before selecting this repair.')
})
test('ready is local admission, not provider health or successful processing', () => {
  const readiness = { status: 'ready', reason: 'ready' }
  expect(isRepairReady(readiness)).toBe(true)
  expect(repairReadinessLabel(readiness)).toContain('Safety checks will run again')
})
