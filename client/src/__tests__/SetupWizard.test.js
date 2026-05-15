/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SetupWizard from '@/views/SetupWizard.vue'
import api from '@/api'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

vi.mock('@/api', () => ({
  default: {
    testTMDB: vi.fn(),
    testOllama: vi.fn(),
    testDiscord: vi.fn(),
    updateTMDBConfig: vi.fn(),
    updateOllamaConfig: vi.fn(),
    updateNotificationsConfig: vi.fn(),
  }
}))

function mountView() {
  return mount(SetupWizard)
}

describe('SetupWizard.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.testTMDB.mockResolvedValue({ data: { success: true } })
    api.testOllama.mockResolvedValue({ data: { success: true } })
    api.testDiscord.mockResolvedValue({ data: { success: true } })
    api.updateTMDBConfig.mockResolvedValue({ data: { success: true } })
    api.updateOllamaConfig.mockResolvedValue({ data: { success: true } })
    api.updateNotificationsConfig.mockResolvedValue({ data: { success: true } })
  })

  it('tests TMDB connectivity and advances through the Ollama step', async () => {
    const wrapper = mountView()

    await wrapper.find('input[placeholder="Your TMDB API key"]').setValue('tmdb-key')

    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await flushPromises()

    expect(api.testTMDB).toHaveBeenCalledWith({
      api_key: 'tmdb-key'
    })
    expect(wrapper.text()).toContain('Connection successful!')

    await buttons[1].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Ollama AI (Optional)')
  })

  it('resets Ollama defaults when skipping that step', async () => {
    const wrapper = mountView()

    await wrapper.find('input[placeholder="Your TMDB API key"]').setValue('tmdb-key')
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    const ollamaInputs = wrapper.findAll('input')
    await ollamaInputs[0].setValue('custom-host')
    await ollamaInputs[1].setValue('22444')

    const skipButton = wrapper.findAll('button').find((button) => button.text().includes('Skip'))
    await skipButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Discord Notifications (Optional)')
    expect(wrapper.find('input[placeholder="Your Discord bot token"]').exists()).toBe(true)
  })

  it('tests Discord connectivity and renders API errors inline', async () => {
    api.testDiscord.mockRejectedValueOnce(new Error('discord offline'))

    const wrapper = mountView()
    await wrapper.find('input[placeholder="Your TMDB API key"]').setValue('tmdb-key')
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    const skipButton = wrapper.findAll('button').find((button) => button.text().includes('Skip'))
    await skipButton.trigger('click')
    await flushPromises()

    await wrapper.find('input[placeholder="Your Discord bot token"]').setValue('discord-token')

    const testButton = wrapper.findAll('button').find((button) => button.text().includes('Test Connection'))
    await testButton.trigger('click')
    await flushPromises()

    expect(api.testDiscord).toHaveBeenCalledWith({
      bot_token: 'discord-token'
    })
    expect(wrapper.text()).toContain('Connection failed: discord offline')
  })

  it('finishes setup and persists TMDB, Ollama, and Discord settings', async () => {
    const wrapper = mountView()

    await wrapper.find('input[placeholder="Your TMDB API key"]').setValue('tmdb-key')
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    const ollamaInputs = wrapper.findAll('input')
    await ollamaInputs[0].setValue('ollama.local')
    await ollamaInputs[1].setValue('11434')

    const nextButton = wrapper.findAll('button').find((button) => button.text() === 'Next')
    await nextButton.trigger('click')
    await flushPromises()

    await wrapper.find('input[placeholder="Your Discord bot token"]').setValue('discord-token')
    await wrapper.find('input[placeholder="Discord channel ID"]').setValue('123456')

    const finishButton = wrapper.findAll('button').find((button) => button.text().includes('Finish Setup'))
    await finishButton.trigger('click')
    await flushPromises()

    expect(api.updateTMDBConfig).toHaveBeenCalledWith({
      api_key: 'tmdb-key',
      language: 'en-US'
    })
    expect(api.updateOllamaConfig).toHaveBeenCalledWith({
      host: 'ollama.local',
      port: 11434,
      model: 'qwen3:14b',
      temperature: 0.3
    })
    expect(api.updateNotificationsConfig).toHaveBeenCalledWith({
      bot_token: 'discord-token',
      channel_id: '123456',
      enabled: true
    })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('skips Discord persistence when using skip and only saves required settings', async () => {
    const wrapper = mountView()

    await wrapper.find('input[placeholder="Your TMDB API key"]').setValue('tmdb-key')
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    const skipOllamaButton = wrapper.findAll('button').find((button) => button.text().includes('Skip'))
    await skipOllamaButton.trigger('click')
    await flushPromises()

    const skipDiscordButton = wrapper.findAll('button').find((button) => button.text().includes('Skip'))
    await skipDiscordButton.trigger('click')
    await flushPromises()

    expect(api.updateTMDBConfig).toHaveBeenCalledWith({
      api_key: 'tmdb-key',
      language: 'en-US'
    })
    expect(api.updateOllamaConfig).toHaveBeenCalledWith({
      host: 'host.docker.internal',
      port: 11434,
      model: 'qwen3:14b',
      temperature: 0.3
    })
    expect(api.updateNotificationsConfig).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/')
  })

  it('renders save failures inline during finish setup', async () => {
    api.updateTMDBConfig.mockRejectedValueOnce(new Error('save failed'))

    const wrapper = mountView()
    await wrapper.find('input[placeholder="Your TMDB API key"]').setValue('tmdb-key')
    await wrapper.findAll('button')[1].trigger('click')
    await flushPromises()

    const skipOllamaButton = wrapper.findAll('button').find((button) => button.text().includes('Skip'))
    await skipOllamaButton.trigger('click')
    await flushPromises()

    const finishButton = wrapper.findAll('button').find((button) => button.text().includes('Finish Setup'))
    await finishButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to save settings: save failed')
    expect(push).not.toHaveBeenCalled()
  })
})
