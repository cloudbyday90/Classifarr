/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import WebSearchProviders from '../views/settings/WebSearchProviders.vue'
import api from '../api'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
}

vi.mock('../api', () => ({
  default: {
    getWebSearchProviderConfigs: vi.fn(),
    updateWebSearchProviderConfig: vi.fn(),
    testWebSearchProvider: vi.fn(),
  },
}))

vi.mock('../stores/toast', () => ({
  useToast: () => toast,
}))

const stubs = {
  Card: { props: ['title', 'description'], template: '<section><h3>{{ title }}</h3><p>{{ description }}</p><slot /></section>' },
  Button: {
    props: ['loading', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  Input: {
    props: ['modelValue', 'label', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<label>{{ label }}<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" /></label>',
  },
  PasswordInput: {
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<input aria-label="API Key" :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  Select: {
    props: ['modelValue', 'label', 'options'],
    emits: ['update:modelValue'],
    template: '<label>{{ label }}<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>',
  },
  TagInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div data-test="tag-input">{{ (modelValue || []).join(",") }}</div>',
  },
  Toggle: {
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    template: '<button type="button" @click="$emit(\'update:modelValue\', !modelValue)">{{ label }} {{ modelValue ? "on" : "off" }}</button>',
  },
}

const providerRows = [
  {
    providerKey: 'tavily',
    displayName: 'Tavily',
    description: 'AI-oriented search',
    docsUrl: 'https://docs.tavily.com/documentation/api-reference/introduction',
    adapterAvailable: true,
    configured: true,
    isEnabled: true,
    priority: 10,
    config: {
      searchDepth: 'advanced',
      maxResults: 5,
      includeDomains: ['imdb.com'],
      excludeDomains: [],
    },
  },
  {
    providerKey: 'brave',
    displayName: 'Brave Search',
    description: 'Independent web search',
    docsUrl: 'https://api-dashboard.search.brave.com/api-reference/web/search/get',
    adapterAvailable: false,
    configured: false,
    isEnabled: false,
    priority: 20,
    config: {},
  },
]

describe('WebSearchProviders settings view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toast.success.mockReset()
    toast.error.mockReset()
    api.getWebSearchProviderConfigs.mockResolvedValue(providerRows)
    api.updateWebSearchProviderConfig.mockResolvedValue({ data: providerRows[0] })
    api.testWebSearchProvider.mockResolvedValue({ data: { success: true } })
  })

  it('renders provider cards and staged adapter status', async () => {
    const wrapper = mount(WebSearchProviders, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('Tavily')
    expect(wrapper.text()).toContain('Brave Search')
    expect(wrapper.text()).toContain('Adapter ready')
    expect(wrapper.text()).toContain('Adapter pending')
  })

  it('saves without echoing a blank masked API key back to the API', async () => {
    const wrapper = mount(WebSearchProviders, { global: { stubs } })
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text() === 'Save')
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateWebSearchProviderConfig).toHaveBeenCalledWith(
      'tavily',
      expect.not.objectContaining({ apiKey: expect.any(String) })
    )
    expect(api.updateWebSearchProviderConfig).toHaveBeenCalledWith(
      'tavily',
      expect.objectContaining({
        isEnabled: true,
        priority: 10,
        config: expect.objectContaining({ searchDepth: 'advanced' }),
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Tavily settings saved')
  })
})
