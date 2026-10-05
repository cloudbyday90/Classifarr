/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Report from '@/components/library/MigrationFailureReport.vue'
import { getMigrationDiagnostics } from '@/api/migrationDiagnosticsApi'
vi.mock('@/api/migrationDiagnosticsApi', () => ({ getMigrationDiagnostics: vi.fn() }))
const available = () => ({ status: 'available', ledgerStatus: 'not_recorded', guidance: 'Review with the maintainer.', report: {
  attemptId: 'synthetic-attempt', finishedAt: '2026-10-05T12:00:00Z', outcome: 'failed', limitations: 'Sanitized trace only.', omittedEvents: 3,
  events: [{ step: 'migration_failed', errors: [{ code: 'unknown' }] }],
} })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:synthetic'), revokeObjectURL: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())
it('loads only on demand, announces context and releases the explicit download URL', async () => {
  getMigrationDiagnostics.mockResolvedValue(available())
  const wrapper = mount(Report)
  expect(getMigrationDiagnostics).not.toHaveBeenCalled()
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toContain('not recorded as applied')
  expect(wrapper.text()).toContain('not proof of the cause')
  expect(wrapper.text()).toContain('3 earlier trace events')
  expect(wrapper.get('pre').text()).toContain('migration_failed')
  expect(wrapper.get('a').attributes('download')).toBe('classifarr-migration-diagnostic.json')
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic')
  wrapper.unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
})
it.each(['none', 'unavailable', 'target_mismatch', 'unrecognized'])('handles %s without offering download or repair', async status => {
  getMigrationDiagnostics.mockResolvedValue({ status })
  const wrapper = mount(Report)
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="status"]').text().length).toBeGreaterThan(20)
  expect(wrapper.find('a').exists()).toBe(false)
  wrapper.unmount()
})
it.each(['applied_since_failure', 'unknown', 'recovered'])('distinguishes %s', async state => {
  const value = available()
  if (state === 'recovered') value.report.outcome = state
  else value.ledgerStatus = state
  getMigrationDiagnostics.mockResolvedValue(value)
  const wrapper = mount(Report)
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.get('[role="status"]').text()).toMatch(/Historical|recovered|not established/)
  wrapper.unmount()
})
it('retains focusable pending control, prevents duplicate reads, and ignores completion after unmount', async () => {
  let resolve
  getMigrationDiagnostics.mockReturnValue(new Promise(done => { resolve = done }))
  const wrapper = mount(Report)
  await wrapper.get('button').trigger('click')
  expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
  await wrapper.get('button').trigger('click')
  expect(getMigrationDiagnostics).toHaveBeenCalledTimes(1)
  wrapper.unmount(); resolve(available()); await flushPromises()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})
it('does not expose raw response errors', async () => {
  getMigrationDiagnostics.mockRejectedValue(new Error('secret stack'))
  const wrapper = mount(Report)
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('could not be read')
  expect(wrapper.text()).not.toContain('secret')
  wrapper.unmount()
})
