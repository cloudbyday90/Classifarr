/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EvaluationInventoryReadiness from '@/components/command-center/EvaluationInventoryReadiness.vue'
import { normalizeEvaluationInventoryReadiness, inventoryReadinessText } from '@/utils/evaluationInventoryReadiness'
import { normalizeEvaluationActivity } from '@/utils/evaluationActivity'
import { evaluationActivityFixture } from '../fixtures/evaluationActivity'

const now = '2026-10-09T12:00:00Z'
const fixture = () => ({ version: 'evaluation_inventory_readiness.v1', status: 'backfilling', completedImports: 10,
  notStarted: 1, scanning: 2, completedHandoffs: 7, dueTasks: 0, processingTasks: 0, latestCheckpointAt: '2026-10-09T11:55:00Z' })

it('explains unfinished scans despite an empty queue, without a recovery shortcut or noisy clock announcement', async () => {
  const value = normalizeEvaluationInventoryReadiness(fixture(), now)
  const wrapper = mount(EvaluationInventoryReadiness, { props: { inventory: value } })
  expect(wrapper.text()).toContain('1 awaiting a backfill scan · 2 scans in progress · 7 scans complete')
  expect(wrapper.text()).toContain('0 due queued tasks · 0 processing tasks')
  expect(wrapper.text()).toContain('empty queue does not mean the scan is finished')
  expect(wrapper.text()).toContain('does not show whether every library is advancing')
  expect(wrapper.find('[role="status"]').text()).toBe(inventoryReadinessText.backfilling)
  expect(wrapper.find('[role="status"] time').exists()).toBe(false)
  expect(wrapper.find('button').exists()).toBe(false)
  expect(wrapper.find('summary').text()).toBe('Backfill progress')
  await wrapper.setProps({ inventory: { ...value, status: 'ready', notStarted: 0, scanning: 0, completedHandoffs: 10, latestCheckpointAt: null } })
  expect(wrapper.find('[role="status"]').text()).toBe(inventoryReadinessText.ready)
  expect(wrapper.find('time').exists()).toBe(false)
})

it.each(Object.keys(inventoryReadinessText))('uses the server admission state %s', status => {
  const value = { ...fixture(), status, completedImports: 0, notStarted: 0, scanning: 0, completedHandoffs: 0, latestCheckpointAt: null }
  expect(mount(EvaluationInventoryReadiness, { props: { inventory: normalizeEvaluationInventoryReadiness(value, now) } }).find('[role="status"]').text()).toBe(inventoryReadinessText[status])
})

it('keeps absent legacy and invalid diagnostics unknown, without losing saved activity', () => {
  const value = evaluationActivityFixture()
  expect(normalizeEvaluationActivity(value).inventory).toBeNull()
  value.inventory = { ...fixture(), libraryName: 'PRIVATE', cursor: 'PRIVATE' }
  expect(JSON.stringify(normalizeEvaluationActivity(value))).not.toContain('PRIVATE')
  value.inventory.status = 'PRIVATE'
  expect(normalizeEvaluationActivity(value).inventory).toBeNull()
  expect(normalizeEvaluationActivity(value).policy.counts.cases).toBe(300)
  expect(mount(EvaluationInventoryReadiness).text()).toContain('details are unavailable')
  const inventory = normalizeEvaluationInventoryReadiness({ ...fixture(), latestCheckpointAt: null }, now)
  expect(mount(EvaluationInventoryReadiness, { props: { inventory } }).text()).toContain('No page checkpoint')
})

it.each([null, {}, { ...fixture(), version: 'unknown' }, { ...fixture(), status: '__proto__' },
  { ...fixture(), status: 'ready' }, { ...fixture(), completedImports: 11 },
  ...['completedImports', 'notStarted', 'scanning', 'completedHandoffs', 'dueTasks', 'processingTasks']
    .flatMap(key => [-1, '1', 1.5, 2147483648].map(value => ({ ...fixture(), [key]: value }))),
  ...['bad', '2026-10-09T12:01:00Z', 123].map(latestCheckpointAt => ({ ...fixture(), latestCheckpointAt })),
  { ...fixture(), notStarted: 3, scanning: 0 },
])('fails closed for malformed progress', value => {
  expect(normalizeEvaluationInventoryReadiness(value, now)).toBeNull()
})

it('rejects a missing observation clock', () => {
  expect(normalizeEvaluationInventoryReadiness(fixture(), 'bad')).toBeNull()
})
