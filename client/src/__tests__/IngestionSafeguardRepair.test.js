/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Repair from '@/components/library/IngestionSafeguardRepair.vue'
import api from '@/api'
vi.mock('@/api', () => ({ default: { previewIngestionSafeguardRepair: vi.fn(), repairIngestionSafeguards: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())
const plan = () => ({ reason: 'confirmation_required', token: 'token', changes: [{ table: 'media_server_items', trigger: 'ingestion_compatibility_rows' }] })
it('does nothing on healthy setup and only requests a preview after interaction', () => {
  const wrapper = mount(Repair)
  expect(wrapper.find('section').exists()).toBe(false)
  expect(api.previewIngestionSafeguardRepair).not.toHaveBeenCalled()
})
it('requires review and confirmation, reports the backup and retains the result after resolution', async () => {
  api.previewIngestionSafeguardRepair.mockResolvedValue(plan())
  api.repairIngestionSafeguards.mockResolvedValue({ data: { status: 'repaired', backup: { id: 'receipt' } } })
  const wrapper = mount(Repair, { props: { needed: true } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('all libraries in this database')
  await wrapper.findAll('button')[1].trigger('click')
  expect(api.repairIngestionSafeguards).not.toHaveBeenCalled()
  await wrapper.get('input').setValue(true)
  await wrapper.findAll('button')[1].trigger('click'); await flushPromises()
  expect(api.repairIngestionSafeguards).toHaveBeenCalledExactlyOnceWith('token')
  expect(wrapper.text()).toContain('Backup receipt is retained')
  expect(wrapper.emitted('repaired')).toHaveLength(1)
  await wrapper.setProps({ needed: false })
  expect(wrapper.text()).toContain('Safeguards repaired')
  wrapper.unmount()
})
it('clears consent after an uncertain result and requires a new review', async () => {
  api.previewIngestionSafeguardRepair.mockResolvedValue(plan())
  api.repairIngestionSafeguards.mockRejectedValue(new Error('timeout'))
  const wrapper = mount(Repair, { props: { needed: true } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  await wrapper.get('input').setValue(true)
  await wrapper.findAll('button')[1].trigger('click'); await flushPromises()
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.text()).toContain('do not repeat the old request')
  expect(api.repairIngestionSafeguards).toHaveBeenCalledTimes(1)
})
it.each(['not_needed', 'definition_changed', 'maintenance_identity_required', 'backup_tools_unavailable'])('does not offer unsafe repair for %s', async reason => {
  api.previewIngestionSafeguardRepair.mockResolvedValue({ reason, changes: [], token: null })
  const wrapper = mount(Repair, { props: { needed: true } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.find('input').exists()).toBe(false)
  expect(wrapper.findAll('button')).toHaveLength(1)
})
it('does not offer confirmation for an inconsistent preview response', async () => {
  api.previewIngestionSafeguardRepair.mockResolvedValue({ ...plan(), reason: 'unknown' })
  const wrapper = mount(Repair, { props: { needed: true } })
  await wrapper.get('button').trigger('click'); await flushPromises()
  expect(wrapper.find('input').exists()).toBe(false)
})
