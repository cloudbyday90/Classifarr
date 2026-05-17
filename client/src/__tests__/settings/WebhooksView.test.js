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
  getWebhookConfigs: vi.fn()
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
})
