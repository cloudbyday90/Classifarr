/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import IngestionRecoveryProgress from '@/components/library/IngestionRecoveryProgress.vue'
import { recoveryProgressView } from '@/utils/ingestionRecoveryProgress'
it('unknown history never invents zero percent or completion', () => {
  const wrapper = mount(IngestionRecoveryProgress)
  expect(wrapper.text()).toContain('Completion not tracked')
  expect(wrapper.find('progress').exists()).toBe(false)
})
it('displays measured metadata progress with one next step and its observation time', () => {
  const wrapper = mount(IngestionRecoveryProgress, { props: { progress: { stage: 'backfilling', reason: 'metadata_pending',
    checkedAt: '2026-10-01T12:00:00Z', metadata: { total: 4, ready: 2, pending: 1, blocked: 1 } } } })
  expect(wrapper.get('progress').attributes()).toMatchObject({ value: '2', max: '4', 'aria-label': 'Verified metadata items' })
  expect(wrapper.text()).toContain('2 / 4 metadata items ready')
  expect(wrapper.text()).toContain('1 waiting · 1 failed')
  expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-01T12:00:00Z')
})
it('supports verified empty sources without a misleading progress bar', () => {
  const wrapper = mount(IngestionRecoveryProgress, { props: { progress: { stage: 'completed',
    metadata: { total: 0, ready: 0, pending: 0, blocked: 0 } } } })
  expect(wrapper.text()).toContain('Recovery completed')
  expect(wrapper.text()).toContain('Optional AI work is separate')
  expect(wrapper.find('progress').exists()).toBe(false)
})
it.each([null, { total: 2, ready: 3, pending: 0, blocked: 0 }, { total: -1, ready: 0, pending: 0, blocked: 0 }])('does not plot missing or invalid counts: %j', metadata => {
    expect(recoveryProgressView({ stage: 'backfilling', metadata }).counts).toBeNull()
  })
it.each(['disabled', 'unconfigured', 'ownership_review', 'source_retry', 'import_retry', 'source_ids', 'enqueue_pending',
  'metadata_failures', 'metadata_pending', 'verification_pending', 'new_scan', 'new_recovery', 'source_changed'])('provides an actionable explanation for %s', reason => {
    expect(recoveryProgressView({ stage: 'blocked', reason }).action.length).toBeGreaterThan(10)
  })
