/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AI from '@/views/settings/AI.vue'
import api from '@/api'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}

vi.mock('@/api', () => ({
  default: {
    getAIConfig: vi.fn(),
    getAIUsage: vi.fn(),
    getPatternConfig: vi.fn(),
    getCostSummary: vi.fn(),
    getAIModels: vi.fn(),
    testAIConnection: vi.fn(),
    updateAIConfig: vi.fn(),
    updatePatternConfig: vi.fn(),
    testOllama: vi.fn(),
    getOllamaModels: vi.fn()
  }
}))

vi.mock('@/stores/toast', () => ({
  useToast: () => toast
}))

const ButtonStub = {
  props: ['disabled', 'variant', 'size'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>'
}

const CardStub = {
  props: ['title'],
  template: '<section><slot /></section>'
}

const ToggleStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />'
}

const SpinnerStub = {
  template: '<div>spinner</div>'
}

const PasswordInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

const baseConfig = {
  primary_provider: 'openai',
  api_endpoint: 'https://api.openai.com/v1',
  api_key: 'sk-masked',
  model: 'gpt-5-mini'
}

function mountView() {
  return mount(AI, {
    global: {
      stubs: {
        Card: CardStub,
        Button: ButtonStub,
        Toggle: ToggleStub,
        Spinner: SpinnerStub,
        PasswordInput: PasswordInputStub
      }
    }
  })
}

describe('AI Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAIConfig.mockResolvedValue({ data: baseConfig })
    api.getAIUsage.mockResolvedValue({ data: null })
    api.getPatternConfig.mockResolvedValue({ data: {} })
    api.getCostSummary.mockResolvedValue({ data: null })
    api.updateAIConfig.mockResolvedValue({ data: { success: true } })
    api.updatePatternConfig.mockResolvedValue({ data: { success: true } })
  })

  it('shows the in-band /settings/ai/models error and clears models', async () => {
    api.getAIModels.mockResolvedValue({
      data: {
        success: false,
        error: 'Stored API key is invalid',
        models: []
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const fetchButton = wrapper.findAll('button').find((button) => button.text().includes('Fetch'))
    expect(fetchButton).toBeDefined()

    await fetchButton.trigger('click')
    await flushPromises()

    expect(api.getAIModels).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    })
    expect(toast.error).toHaveBeenCalledWith('Stored API key is invalid')
    expect(wrapper.text()).toContain('Select a model...')
    expect(wrapper.text()).not.toContain('gpt-5-mini')
  })

  it('surfaces the /settings/ai/test route error payload when the request is rejected', async () => {
    api.testAIConnection.mockRejectedValue({
      response: {
        data: {
          error: 'API key is required'
        }
      }
    })

    const wrapper = mountView()
    await flushPromises()

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    expect(testButton).toBeDefined()

    await testButton.trigger('click')
    await flushPromises()

    expect(api.testAIConnection).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    })
    expect(wrapper.text()).toContain('API key is required')
  })

  it('warns when AI config saves but pattern settings fail', async () => {
    api.updatePatternConfig.mockRejectedValueOnce(new Error('pattern service unavailable'))

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    expect(saveButton).toBeDefined()

    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateAIConfig).toHaveBeenCalledWith(expect.objectContaining({
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'sk-masked'
    }))
    expect(api.updatePatternConfig).toHaveBeenCalledTimes(1)
    expect(toast.warning).toHaveBeenCalledWith(
      'AI provider settings were saved, but pattern settings failed: pattern service unavailable'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('stops before pattern settings when the AI config save fails', async () => {
    api.updateAIConfig.mockRejectedValueOnce(new Error('provider save failed'))

    const wrapper = mountView()
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('Save Changes'))
    expect(saveButton).toBeDefined()

    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updatePatternConfig).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('provider save failed')
    expect(toast.warning).not.toHaveBeenCalled()
  })
})
