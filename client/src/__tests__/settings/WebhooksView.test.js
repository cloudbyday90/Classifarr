/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WebhooksView from '@/views/settings/Webhooks.vue'
import api from '@/api'

const apiMock = vi.hoisted(() => ({
  getWebhookConfig: vi.fn(),
  generateWebhookKey: vi.fn(),
  getWebhookStats: vi.fn(),
  getWebhookLogs: vi.fn(),
  getWebhookConfigs: vi.fn(),
  updateWebhookConfig: vi.fn(),
  testWebhook: vi.fn(),
  createWebhookConfig: vi.fn(),
  deleteWebhookConfig: vi.fn(),
  setPrimaryWebhookConfig: vi.fn()
}))

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}))

vi.mock('@/api', () => ({
  default: apiMock
}))

vi.mock('@/stores/toast', () => ({
  useToast: () => toastMock
}))

const ButtonStub = {
  props: ['disabled'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
}

const ToggleStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<button @click="$emit(\'update:modelValue\', !modelValue)"><slot /></button>'
}

const SpinnerStub = {
  template: '<div data-test="spinner" />'
}

const CardStub = {
  template: '<div data-test="card"><slot /></div>'
}

const WebhookAuthorizationHeaderCardStub = {
  props: ['maskedSecretKey', 'secretStatus'],
  template: '<div data-test="header-card" :data-secret-status="secretStatus">{{ maskedSecretKey }}</div>'
}

function mountView() {
  return mount(WebhooksView, {
    global: {
      stubs: {
        Card: CardStub,
        Button: ButtonStub,
        Toggle: ToggleStub,
        Spinner: SpinnerStub,
        WebhookAuthorizationHeaderCard: WebhookAuthorizationHeaderCardStub
      }
    }
  })
}

describe('Webhooks view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getWebhookStats.mockResolvedValue({ total: 0, completed: 0, failed: 0, avgProcessingTime: 0 })
    api.getWebhookLogs.mockResolvedValue({ logs: [], page: 1, totalPages: 1, limit: 20 })
    api.getWebhookConfigs.mockResolvedValue([])
    api.getWebhookConfig.mockResolvedValue({
      enabled: true,
      webhook_type: 'overseerr',
      secret_key: 'test-key',
      secret_key_status: 'available',
      process_pending: true,
      process_approved: true,
      process_auto_approved: true,
      process_declined: false,
      notify_on_receive: true,
      notify_on_error: true,
      include_specials: false
    })
    api.updateWebhookConfig.mockResolvedValue({ data: { enabled: true, secret_key: 'test-key', secret_key_status: 'available' } })
    api.testWebhook.mockResolvedValue({})
    api.createWebhookConfig.mockResolvedValue({})
    api.deleteWebhookConfig.mockResolvedValue({})
    api.setPrimaryWebhookConfig.mockResolvedValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not auto-generate a webhook authorization header when the config has no secret', async () => {
    api.getWebhookConfig.mockResolvedValue({
      enabled: true,
      secret_key: '',
      secret_key_status: 'missing'
    })

    const wrapper = mountView()
    await flushPromises()

    expect(api.generateWebhookKey).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Webhook Security Warning')
    expect(wrapper.find('[data-test="header-card"]').attributes('data-secret-status')).toBe('missing')
  })

  it('shows the explicit unavailable warning when the stored secret cannot be decrypted', async () => {
    api.getWebhookConfig.mockResolvedValue({
      enabled: true,
      secret_key: '••••••••1234',
      secret_key_status: 'unavailable'
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Webhook Authorization Header Unavailable')
    expect(wrapper.text()).toContain('Restore the key or explicitly regenerate the header below.')
    expect(wrapper.find('[data-test="header-card"]').attributes('data-secret-status')).toBe('unavailable')
  })

  it('shows Spinner during initial load', async () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-test="spinner"]').exists()).toBe(true)
    await flushPromises()
    expect(wrapper.find('[data-test="spinner"]').exists()).toBe(false)
  })

  it('shows Active badge and webhook endpoint URL in view mode', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Webhook Endpoint')
    expect(wrapper.text()).toContain('JSON Payload')
  })

  it('shows Inactive badge when webhook is disabled', async () => {
    api.getWebhookConfig.mockResolvedValue({
      enabled: false,
      secret_key: '',
      secret_key_status: 'missing',
      process_pending: true,
      process_approved: true,
      process_auto_approved: true,
      process_declined: false,
      notify_on_receive: true,
      notify_on_error: true,
      include_specials: false
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Inactive')
  })

  it('includes secret key query param in webhook URL when key is available', async () => {
    api.getWebhookConfig.mockResolvedValue({
      enabled: true,
      webhook_type: 'overseerr',
      secret_key: 'my-secret-key',
      secret_key_status: 'available',
      process_pending: true,
      process_approved: true,
      process_auto_approved: true,
      process_declined: false,
      notify_on_receive: true,
      notify_on_error: true,
      include_specials: false
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('key=my-secret-key')
  })

  it('excludes secret key query param when secret is masked', async () => {
    api.getWebhookConfig.mockResolvedValue({
      enabled: true,
      webhook_type: 'overseerr',
      secret_key: '••••••••12ab',
      secret_key_status: 'available',
      process_pending: true,
      process_approved: true,
      process_auto_approved: true,
      process_declined: false,
      notify_on_receive: true,
      notify_on_error: true,
      include_specials: false
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).not.toContain('key=')
  })

  it('uses window.location.origin in webhook URL', async () => {
    api.getWebhookConfig.mockResolvedValue({
      enabled: true,
      webhook_type: 'overseerr',
      secret_key: '',
      secret_key_status: 'missing',
      process_pending: true,
      process_approved: true,
      process_auto_approved: true,
      process_declined: false,
      notify_on_receive: true,
      notify_on_error: true,
      include_specials: false
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain(window.location.origin + '/api/webhook/request')
  })

  it('calls testWebhook and shows toast.success on success', async () => {
    api.testWebhook.mockResolvedValue({})
    const wrapper = mountView()
    await flushPromises()
    const testBtn = wrapper.findAll('button').find(b => b.text().includes('🧪'))
    await testBtn.trigger('click')
    await flushPromises()
    expect(api.testWebhook).toHaveBeenCalled()
    expect(toastMock.success).toHaveBeenCalledWith('Test webhook sent successfully')
    expect(api.getWebhookLogs).toHaveBeenCalledTimes(2)
    expect(api.getWebhookStats).toHaveBeenCalledTimes(2)
  })

  it('shows toastMock.error when testWebhook fails', async () => {
    api.testWebhook.mockRejectedValue(new Error('connection failed'))
    const wrapper = mountView()
    await flushPromises()
    const testBtn = wrapper.findAll('button').find(b => b.text().includes('🧪'))
    await testBtn.trigger('click')
    await flushPromises()
    expect(toastMock.error).toHaveBeenCalled()
  })

  it('copies webhook URL to clipboard and shows toastMock.success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountView()
    await flushPromises()
    const copyBtn = wrapper.findAll('button').find(b => b.text().includes('Copy'))
    await copyBtn.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalled()
    expect(toastMock.success).toHaveBeenCalledWith('Webhook URL copied to clipboard')
  })

  it('copies JSON payload to clipboard and shows toastMock.success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mountView()
    await flushPromises()
    const payloadBtn = wrapper.findAll('button').find(b => b.text().trim() === '📋')
    await payloadBtn.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('notification_type'))
    expect(toastMock.success).toHaveBeenCalledWith('JSON payload copied to clipboard')
  })

  it('calls updateWebhookConfig when toggling enable/disable in edit mode', async () => {
    api.updateWebhookConfig.mockResolvedValue({ data: { enabled: false, secret_key: 'test-key', secret_key_status: 'available' } })
    const wrapper = mountView()
    await flushPromises()
    const configureBtn = wrapper.findAll('button').find(b => b.text().includes('Configure'))
    await configureBtn.trigger('click')
    await flushPromises()
    const allButtons = wrapper.findAll('button')
    const toggleButtons = allButtons.filter(b => b.text().trim() === '')
    await toggleButtons[0].trigger('click')
    await flushPromises()
    expect(api.updateWebhookConfig).toHaveBeenCalled()
    expect(toastMock.success).toHaveBeenCalledWith('Webhook configuration saved')
  })

  it('shows edit mode with event rules toggles when Configure is clicked', async () => {
    const wrapper = mountView()
    await flushPromises()
    const configureBtn = wrapper.findAll('button').find(b => b.text().includes('Configure'))
    await configureBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Configuration')
    expect(wrapper.text()).toContain('Event Rules')
    expect(wrapper.text()).toContain('Pending Requests')
    expect(wrapper.text()).toContain('Approved Requests')
    expect(wrapper.text()).toContain('Auto-Approved')
    expect(wrapper.text()).toContain('Declined Requests')
    expect(wrapper.text()).toContain('Include Specials (Season 0)')
  })

  it('shows add source modal and creates a new source', async () => {
    api.createWebhookConfig.mockResolvedValue({})
    const wrapper = mountView()
    await flushPromises()
    const configureBtn = wrapper.findAll('button').find(b => b.text().includes('Configure'))
    await configureBtn.trigger('click')
    await flushPromises()
    const addSourceTrigger = wrapper.findAll('button').find(b => b.text().includes('+ Add Source'))
    await addSourceTrigger.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Add Webhook Source')
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('select').exists()).toBe(true)
    await wrapper.find('input[type="text"]').setValue('Test Source')
    const modalAddBtn = wrapper.findAll('button').find(b => b.text().trim() === 'Add Source')
    await modalAddBtn.trigger('click')
    await flushPromises()
    expect(api.createWebhookConfig).toHaveBeenCalledWith({ name: 'Test Source', webhook_type: 'overseerr' })
    expect(toastMock.success).toHaveBeenCalledWith('Source added')
  })

  it('deletes a source after confirmation', async () => {
    api.getWebhookConfigs.mockResolvedValue([
      { id: 1, name: 'Source A', webhook_type: 'overseerr', is_primary: true, enabled: true },
      { id: 2, name: 'Source B', webhook_type: 'jellyseerr', is_primary: false, enabled: true }
    ])
    api.deleteWebhookConfig.mockResolvedValue({})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountView()
    await flushPromises()
    const configureBtn = wrapper.findAll('button').find(b => b.text().includes('Configure'))
    await configureBtn.trigger('click')
    await flushPromises()
    const deleteBtn = wrapper.findAll('button').find(b => b.text().includes('✕'))
    await deleteBtn.trigger('click')
    await flushPromises()
    expect(window.confirm).toHaveBeenCalledWith('Delete this webhook source?')
    expect(api.deleteWebhookConfig).toHaveBeenCalled()
    expect(toastMock.success).toHaveBeenCalledWith('Source deleted')
  })

  it('sets primary source and shows toast.success', async () => {
    api.getWebhookConfigs.mockResolvedValue([
      { id: 1, name: 'Source A', webhook_type: 'overseerr', is_primary: true, enabled: true },
      { id: 2, name: 'Source B', webhook_type: 'jellyseerr', is_primary: false, enabled: true }
    ])
    api.setPrimaryWebhookConfig.mockResolvedValue({})
    const wrapper = mountView()
    await flushPromises()
    const configureBtn = wrapper.findAll('button').find(b => b.text().includes('Configure'))
    await configureBtn.trigger('click')
    await flushPromises()
    const setPrimaryBtn = wrapper.findAll('button').find(b => b.text().includes('Set Primary'))
    await setPrimaryBtn.trigger('click')
    await flushPromises()
    expect(api.setPrimaryWebhookConfig).toHaveBeenCalledWith(2)
    expect(toastMock.success).toHaveBeenCalledWith('Primary source updated')
  })

  it('shows recent activity log entries', async () => {
    api.getWebhookLogs.mockResolvedValue({
      logs: [
        { id: 1, media_title: 'Test Movie', processing_status: 'completed', notification_type: 'TEST', received_at: '2025-01-01T00:00:00Z' },
        { id: 2, media_title: 'Another Movie', processing_status: 'failed', notification_type: 'APPROVED', received_at: '2025-01-02T00:00:00Z' }
      ],
      page: 1,
      totalPages: 1,
      limit: 20
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Recent Activity')
    expect(wrapper.text()).toContain('Test Movie')
    expect(wrapper.text()).toContain('completed')
    expect(wrapper.text()).toContain('Another Movie')
    expect(wrapper.text()).toContain('failed')
  })

  it('shows stats display when stats are available', async () => {
    api.getWebhookStats.mockResolvedValue({ total: 42, completed: 38, failed: 4, avgProcessingTime: 120 })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('38')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('120ms')
    expect(wrapper.text()).toContain('Total Received')
    expect(wrapper.text()).toContain('Processed')
    expect(wrapper.text()).toContain('Failed')
    expect(wrapper.text()).toContain('Avg Time')
  })

  it('opens and closes the setup guide modal', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).not.toContain('How to Configure Overseerr/Jellyseerr')
    const setupBtn = wrapper.findAll('button').find(b => b.text().includes('Setup Guide'))
    await setupBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('How to Configure Overseerr/Jellyseerr')
    expect(wrapper.text()).toContain('Got it')
    const closeBtn = wrapper.findAll('button').find(b => b.text().includes('✕'))
    await closeBtn.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('How to Configure Overseerr/Jellyseerr')
  })
})
