/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WebhookAuthorizationHeaderCard from '@/components/settings/WebhookAuthorizationHeaderCard.vue'
import api from '@/api'

const apiMock = vi.hoisted(() => ({
  getWebhookSecret: vi.fn(),
  generateWebhookKey: vi.fn()
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

const CardStub = {
  template: '<div data-test="card"><slot /></div>'
}

const ButtonStub = {
  props: ['disabled'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
}

const MASKED_SECRET = '••••••••dt2Q'
const FULL_SECRET = 'whsec_fullSecret_dt2Q'

function mountCard(props = {}) {
  return mount(WebhookAuthorizationHeaderCard, {
    props: {
      maskedSecretKey: MASKED_SECRET,
      secretStatus: 'available',
      ...props
    },
    global: {
      stubs: {
        Card: CardStub,
        Button: ButtonStub
      }
    }
  })
}

function getInput(wrapper) {
  return wrapper.find('input')
}

function getButtonByText(wrapper, text) {
  const button = wrapper.findAll('button').find(b => b.text().includes(text))
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
}

describe('WebhookAuthorizationHeaderCard', () => {
  const originalClipboard = global.navigator?.clipboard
  const originalConfirm = global.confirm
  let writeTextMock
  let consoleErrorSpy

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    writeTextMock = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock }
    })

    global.confirm = vi.fn(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    consoleErrorSpy?.mockRestore()
  })

  afterAll(() => {
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard
    })
    global.confirm = originalConfirm
  })

  it('does not auto-generate a secret when missing on mount', async () => {
    const wrapper = mountCard({ maskedSecretKey: '', secretStatus: 'missing' })
    await flushPromises()

    expect(api.generateWebhookKey).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Authorization Header Required')
    expect(getButtonByText(wrapper, 'Generate').exists()).toBe(true)
  })

  it('does not show a missing-secret warning while the secret status is still unresolved', async () => {
    const wrapper = mountCard({ maskedSecretKey: '', secretStatus: 'unknown' })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Authorization Header Required')
    expect(getInput(wrapper).attributes('placeholder')).toBe('Loading authorization header state')
  })

  it('shows unavailable guidance and disables reveal/copy when the stored secret cannot be decrypted', async () => {
    const wrapper = mountCard({ maskedSecretKey: MASKED_SECRET, secretStatus: 'unavailable' })
    await flushPromises()

    expect(wrapper.text()).toContain('Stored Authorization Header Unavailable')
    expect(wrapper.text()).toContain('cannot be decrypted')
    expect(wrapper.findAll('button').some(button => button.text().includes('Unmask'))).toBe(false)
    expect(wrapper.findAll('button').some(button => button.text().includes('Copy'))).toBe(false)
    expect(getButtonByText(wrapper, 'Regenerate').exists()).toBe(true)
  })

  it('unmasks and re-masks authorization header reliably', async () => {
    api.getWebhookSecret.mockResolvedValue({ secret_key: FULL_SECRET })

    const wrapper = mountCard()
    expect(getInput(wrapper).element.value).toBe(MASKED_SECRET)

    await getButtonByText(wrapper, 'Unmask').trigger('click')
    await flushPromises()

    expect(api.getWebhookSecret).toHaveBeenCalledTimes(1)
    expect(getInput(wrapper).element.value).toBe(FULL_SECRET)

    await getButtonByText(wrapper, 'Mask').trigger('click')
    await flushPromises()

    expect(getInput(wrapper).element.value).toBe(MASKED_SECRET)
  })

  it('copies visible unmasked header without refetching', async () => {
    api.getWebhookSecret.mockResolvedValue({ secret_key: FULL_SECRET })

    const wrapper = mountCard()

    await getButtonByText(wrapper, 'Unmask').trigger('click')
    await flushPromises()

    await getButtonByText(wrapper, 'Copy').trigger('click')
    await flushPromises()

    expect(api.getWebhookSecret).toHaveBeenCalledTimes(1)
    expect(writeTextMock).toHaveBeenCalledWith(FULL_SECRET)
    expect(toastMock.success).toHaveBeenCalledWith('Authorization header copied to clipboard')
  })

  it('copies full header while remaining masked when still masked in UI', async () => {
    api.getWebhookSecret.mockResolvedValue({ secret_key: FULL_SECRET })

    const wrapper = mountCard()
    expect(getInput(wrapper).element.value).toBe(MASKED_SECRET)

    await getButtonByText(wrapper, 'Copy').trigger('click')
    await flushPromises()

    expect(api.getWebhookSecret).toHaveBeenCalledTimes(1)
    expect(writeTextMock).toHaveBeenCalledWith(FULL_SECRET)
    expect(getInput(wrapper).element.value).toBe(MASKED_SECRET)
  })

  it('regenerates and emits updated masked secret', async () => {
    api.generateWebhookKey.mockResolvedValue({ data: { secret_key: FULL_SECRET } })

    const wrapper = mountCard()

    await getButtonByText(wrapper, 'Regenerate').trigger('click')
    await flushPromises()

    expect(global.confirm).toHaveBeenCalledTimes(1)
    expect(api.generateWebhookKey).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('secret-updated')?.[0]?.[0]).toBe('••••••••dt2Q')
    expect(wrapper.emitted('secret-status-updated')?.[0]?.[0]).toBe('available')
    expect(getInput(wrapper).element.value).toBe(FULL_SECRET)
  })

  it('does not regenerate when user cancels confirmation', async () => {
    global.confirm = vi.fn(() => false)
    const wrapper = mountCard()

    await getButtonByText(wrapper, 'Regenerate').trigger('click')
    await flushPromises()

    expect(api.generateWebhookKey).not.toHaveBeenCalled()
  })

  it('shows error and stays masked when unmask fails', async () => {
    api.getWebhookSecret.mockRejectedValue(new Error('boom'))
    const wrapper = mountCard()

    await getButtonByText(wrapper, 'Unmask').trigger('click')
    await flushPromises()

    expect(toastMock.error).toHaveBeenCalledWith('Failed to reveal authorization header')
    expect(getInput(wrapper).element.value).toBe(MASKED_SECRET)
  })

  it('surfaces the server-provided mismatch error when reveal fails with a 409', async () => {
    api.getWebhookSecret.mockRejectedValue({
      response: {
        data: {
          error: 'Webhook authorization header is unavailable because the stored encryption key no longer matches the persisted secret.'
        }
      }
    })
    const wrapper = mountCard()

    await getButtonByText(wrapper, 'Unmask').trigger('click')
    await flushPromises()

    expect(toastMock.error).toHaveBeenCalledWith(
      'Webhook authorization header is unavailable because the stored encryption key no longer matches the persisted secret.'
    )
  })

  it('clears visible secret when masked secret prop is removed', async () => {
    api.getWebhookSecret.mockResolvedValue({ secret_key: FULL_SECRET })

    const wrapper = mountCard()

    await getButtonByText(wrapper, 'Unmask').trigger('click')
    await flushPromises()
    expect(getInput(wrapper).element.value).toBe(FULL_SECRET)

    await wrapper.setProps({ maskedSecretKey: '' })
    await flushPromises()

    expect(getInput(wrapper).element.value).toBe('')
  })

  it('returns to masked state after component remount (navigation cleanup)', async () => {
    api.getWebhookSecret.mockResolvedValue({ secret_key: FULL_SECRET })

    const firstWrapper = mountCard()
    await getButtonByText(firstWrapper, 'Unmask').trigger('click')
    await flushPromises()
    expect(getInput(firstWrapper).element.value).toBe(FULL_SECRET)
    firstWrapper.unmount()

    const secondWrapper = mountCard()
    await flushPromises()
    expect(getInput(secondWrapper).element.value).toBe(MASKED_SECRET)
  })

  it('auto-remasks after inactivity timeout', async () => {
    vi.useFakeTimers()
    api.getWebhookSecret.mockResolvedValue({ secret_key: FULL_SECRET })

    const wrapper = mountCard({ autoRemaskTimeoutMs: 1000 })
    await getButtonByText(wrapper, 'Unmask').trigger('click')
    await flushPromises()

    expect(getInput(wrapper).element.value).toBe(FULL_SECRET)

    await vi.advanceTimersByTimeAsync(999)
    expect(getInput(wrapper).element.value).toBe(FULL_SECRET)

    await vi.advanceTimersByTimeAsync(1)
    expect(getInput(wrapper).element.value).toBe(MASKED_SECRET)
  })

  it('resets auto-remask timer when user copies while unmasked', async () => {
    vi.useFakeTimers()
    api.getWebhookSecret.mockResolvedValue({ secret_key: FULL_SECRET })

    const wrapper = mountCard({ autoRemaskTimeoutMs: 1000 })
    await getButtonByText(wrapper, 'Unmask').trigger('click')
    await flushPromises()

    await vi.advanceTimersByTimeAsync(700)
    await getButtonByText(wrapper, 'Copy').trigger('click')
    await flushPromises()

    await vi.advanceTimersByTimeAsync(700)
    expect(getInput(wrapper).element.value).toBe(FULL_SECRET)

    await vi.advanceTimersByTimeAsync(300)
    expect(getInput(wrapper).element.value).toBe(MASKED_SECRET)
  })
})
