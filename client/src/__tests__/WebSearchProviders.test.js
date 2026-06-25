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
    getWebSearchProviderRouteDiagnostics: vi.fn(),
    getWebSearchProviderCalibrationPolicies: vi.fn(),
    updateWebSearchProviderCalibrationPolicy: vi.fn(),
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
    adapterAvailable: true,
    configured: true,
    isEnabled: true,
    priority: 20,
    config: { country: 'US', safeSearch: true },
  },
  {
    providerKey: 'serper',
    displayName: 'Serper.dev',
    description: 'Google SERP API',
    docsUrl: 'https://serper.dev/',
    adapterAvailable: true,
    configured: true,
    isEnabled: true,
    priority: 30,
    config: { gl: 'us', hl: 'en' },
  },
]

describe('WebSearchProviders settings view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toast.success.mockReset()
    toast.error.mockReset()
    api.getWebSearchProviderConfigs.mockResolvedValue(providerRows)
    api.getWebSearchProviderRouteDiagnostics.mockResolvedValue({
      selectedProviderKey: 'tavily',
      candidates: [{
        providerKey: 'tavily',
        displayName: 'Tavily',
        priority: 10,
        status: 'available',
        skipReason: null,
        quota: {
          dailyCostUnits: 2,
          dailyLimit: 100,
          monthlyCostUnits: 6,
          monthlyLimit: 1000,
        },
        usage: {
          dailyRequestCount: 2,
          monthlyRequestCount: 6,
          dailyCacheHits: 1,
          monthlyCacheHits: 3,
        },
        quality: {
          score: 88,
          priorityPenalty: 3,
          sampleCount: 12,
          status: 'calibrated',
          minimumSamples: 3,
        },
        effectivePriority: 13,
        cooldownUntil: null,
      }],
      recentDecisions: [{
        id: 1,
        routeId: 'f0d8da38-c8b6-4fd6-822a-758dc13b9624',
        purpose: 'classification_enrichment',
        outcome: 'success',
        selectedProviderKey: 'tavily',
        finalProviderKey: 'tavily',
        attemptCount: 1,
        createdAt: '2026-06-25T02:00:00.000Z',
        completedAt: '2026-06-25T02:00:01.000Z',
      }],
      recentHealthEvents: [{
        id: 2,
        providerKey: 'tavily',
        eventType: 'cooldown_started',
        healthStatus: 'cooldown',
        errorCode: 'rate_limited',
        cooldownUntil: '2026-06-25T02:05:00.000Z',
        createdAt: '2026-06-25T02:00:30.000Z',
      }],
    })
    api.getWebSearchProviderCalibrationPolicies.mockResolvedValue([{
      purpose: 'classification',
      isEnabled: true,
      lookbackDays: 14,
      minimumSamples: 3,
      maximumPriorityPenalty: 25,
      outcomeWeight: 15,
    }])
    api.updateWebSearchProviderCalibrationPolicy.mockResolvedValue({
      data: {
        purpose: 'classification',
        isEnabled: true,
        lookbackDays: 30,
        minimumSamples: 5,
        maximumPriorityPenalty: 20,
        outcomeWeight: 12,
      },
    })
    api.updateWebSearchProviderConfig.mockResolvedValue({ data: providerRows[0] })
    api.testWebSearchProvider.mockResolvedValue({ data: { success: true } })
  })

  it('renders provider cards and active adapter status', async () => {
    const wrapper = mount(WebSearchProviders, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('Tavily')
    expect(wrapper.text()).toContain('Brave Search')
    expect(wrapper.text()).toContain('Serper.dev')
    expect(wrapper.text()).toContain('Adapter ready')
    expect(wrapper.text()).toContain('Strict Safe Search')
    expect(wrapper.text()).toContain('Language')
    expect(wrapper.text()).not.toContain('Adapter pending')
    expect(wrapper.text()).toContain('Next eligible provider: Tavily')
    expect(wrapper.text()).toContain('Today: 2 / 100')
    expect(wrapper.text()).toContain('Quality: 88% over 12 samples, +3 priority')
    expect(wrapper.text()).toContain('Effective priority: 13')
    expect(wrapper.text()).toContain('Recent route decisions')
    expect(wrapper.text()).toContain('classification_enrichment')
    expect(wrapper.text()).toContain('1 attempt')
    expect(wrapper.text()).toContain('Recent provider health events')
    expect(wrapper.text()).toContain('Cooldown started')
    expect(wrapper.text()).toContain('rate_limited')
    expect(wrapper.text()).toContain('Purpose Calibration')
    expect(wrapper.text()).toContain('Classification')
    expect(wrapper.text()).toContain('Lookback Days')
    expect(wrapper.text()).toContain('Outcome Weight')
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
    expect(api.getWebSearchProviderRouteDiagnostics).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Tavily settings saved')
  })

  it('saves purpose-specific calibration settings', async () => {
    const wrapper = mount(WebSearchProviders, { global: { stubs } })
    await flushPromises()

    const saveButton = wrapper.findAll('button').find((button) => button.text() === 'Save Calibration')
    await saveButton.trigger('click')
    await flushPromises()

    expect(api.updateWebSearchProviderCalibrationPolicy).toHaveBeenCalledWith(
      'classification',
      expect.objectContaining({
        isEnabled: true,
        lookbackDays: 14,
        minimumSamples: 3,
        maximumPriorityPenalty: 25,
        outcomeWeight: 15,
      })
    )
    expect(api.getWebSearchProviderRouteDiagnostics).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Classification calibration saved')
  })
})
