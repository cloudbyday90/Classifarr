/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import InventoryRecoveryProgress from '@/components/library/InventoryRecoveryProgress.vue'
import { parseInventoryRecoveryProgress, recoveryDuration, recoveryNextStep, recoveryReadinessLabel } from '@/utils/inventoryRecoveryProgress'
import { inventoryRecoveryProgressFixture } from '../fixtures/inventoryRecovery'

it('validates counts, timing denominators, known states and limits', () => {
  expect(parseInventoryRecoveryProgress(inventoryRecoveryProgressFixture()).total).toBe(10)
  for (const patch of [{ version: 9 }, { limit: 10000 }, { windowDays: 365 }, { total: -1 }, { total: 11 },
    { readiness: '<script>' }, { truncated: 1 }, { asOf: 'bad' }, { stages: {} }, { oldestReadySeconds: -1 },
    { eligibleToQueue: { samples: 11, seconds: 5 } }, { queueToRecovery: { samples: 0, seconds: 0 } },
    { queueToRecovery: { samples: 1, seconds: null } }]) {
    expect(() => parseInventoryRecoveryProgress({ ...inventoryRecoveryProgressFixture(), ...patch })).toThrow()
  }
})
it('formats durations without invented precision and selects one actionable next step', () => {
  expect([null, 30, 120, 3660, 90000].map(recoveryDuration)).toEqual(['Not measured', '30s', '2m', '1h 1m', '1d 1h'])
  const report = inventoryRecoveryProgressFixture()
  expect(recoveryNextStep(report)).toContain('source conflicts')
  for (const state of ['waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling', 'unavailable']) {
    expect(recoveryNextStep({ ...report, readiness: state })).toBe(recoveryReadinessLabel(state))
  }
  report.stages.blocked = 0; report.stages.unknown = 1
  expect(recoveryNextStep(report)).toContain('could not be verified')
  report.stages.unknown = 0; expect(recoveryNextStep(report)).toContain('10m')
  report.stages.ready = 0; expect(recoveryNextStep(report)).toContain('No manual retry')
  report.stages.queued = 0; report.stages.checking = 0; expect(recoveryNextStep(report)).toContain('cooldowns')
  report.stages.waiting = 0; expect(recoveryNextStep(report)).toContain('No action')
  report.total = 0; expect(recoveryNextStep(report)).toContain('No credential-released')
})
it('pairs the visual bar with text counts, does not round incomplete recovery to 100%, and has an honest empty state', () => {
  const report = inventoryRecoveryProgressFixture()
  const wrapper = mount(InventoryRecoveryProgress, { props: { report } })
  expect(wrapper.text()).toContain('50%')
  expect(wrapper.find('[aria-label="Recovery stage counts"]').text()).toContain('Recovered 5')
  expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
  wrapper.unmount()
  const almost = { ...report, total: 1000, stages: { ...report.stages, recovered: 999 } }
  const near = mount(InventoryRecoveryProgress, { props: { report: almost } })
  expect(near.text()).toContain('99.9%'); expect(near.text()).not.toContain('100%'); near.unmount()
  const empty = mount(InventoryRecoveryProgress, { props: { report: { ...report, total: 0, readiness: 'waiting_for_inventory' } } })
  expect(empty.text()).toContain('—'); expect(empty.text()).not.toContain('100%'); empty.unmount()
})
