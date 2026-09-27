/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Backup from '@/views/settings/Backup.vue'
const { api, toast } = vi.hoisted(() => ({
  api: { getBackupRuntime: vi.fn(), listBackups: vi.fn(), previewBackupFile: vi.fn(), restoreBackup: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('@/api', () => ({ default: api }))
vi.mock('@/stores/toast', () => ({ useToast: () => toast }))
const button = (wrapper, label) => wrapper.findAll('button').find(item => item.text().includes(label))
async function preview(wrapper) {
  await flushPromises()
  await wrapper.find('select').setValue(wrapper.findAll('option')[1].element.value)
  await button(wrapper, 'Preview Backup').trigger('click')
  await flushPromises()
}
describe('restore mode controls', () => {
  let wrapper
  beforeEach(() => {
    vi.clearAllMocks()
    api.listBackups.mockResolvedValue({ backups: [{ filename: 'config.json', type: 'plaintext', size: 1024, createdAt: '2026-09-27' }] })
    api.previewBackupFile.mockResolvedValue({ data: { itemCounts: {}, exportedAt: '2026-09-27' } })
    api.restoreBackup.mockResolvedValue({ data: { stats: {}, newApiKey: 'test-only' } })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })
  afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

  it.each(['normal', 'unavailable', 'pending'])('blocks restore with visible guidance when %s', async mode => {
    if (mode === 'normal') api.getBackupRuntime.mockResolvedValue({ mode, restoreAllowed: false })
    else if (mode === 'unavailable') api.getBackupRuntime.mockRejectedValue(new Error('offline'))
    else api.getBackupRuntime.mockReturnValue(new Promise(() => {}))
    wrapper = mount(Backup)
    await preview(wrapper)
    expect(button(wrapper, 'Restore Backup').attributes('disabled')).toBeDefined()
    await button(wrapper, 'Restore Backup').trigger('click')
    expect(api.restoreBackup).not.toHaveBeenCalled()
    expect(wrapper.find('[role="status"]').text()).toContain(mode === 'normal' ? 'stop all normal instances' : 'Restore stays disabled')
  })

  it('allows explicit restore, hides export, and announces restart without auto-resume', async () => {
    api.getBackupRuntime.mockResolvedValue({ mode: 'restore', restoreAllowed: true })
    wrapper = mount(Backup)
    await preview(wrapper)
    expect(wrapper.text()).not.toContain('Create Backup')
    expect(wrapper.find('button[title="Download"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[title="Delete"]').attributes('disabled')).toBeDefined()
    expect(button(wrapper, 'Restore Backup').attributes('disabled')).toBeUndefined()
    await button(wrapper, 'Restore Backup').trigger('click')
    await flushPromises()
    expect(api.restoreBackup).toHaveBeenCalledWith('config.json', undefined, 'replace')
    expect(wrapper.find('[role="status"]').text()).toContain('Restore verified. Restart')
    expect(wrapper.find('[role="status"]').attributes('aria-atomic')).toBe('true')
    expect(api.restoreBackup).toHaveBeenCalledTimes(1)
  })
})
