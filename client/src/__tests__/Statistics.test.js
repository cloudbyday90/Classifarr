/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Statistics from '@/views/Statistics.vue'

vi.mock('@/views/statistics/ClassificationStats.vue', () => ({
  default: { template: '<div data-testid="classification-stats">classification stats</div>' }
}))

vi.mock('@/views/statistics/CandidateBoundVerificationStats.vue', () => ({
  default: { template: '<div data-testid="candidate-bound-verification-stats">verification stats</div>' }
}))

vi.mock('@/views/statistics/RAGStats.vue', () => ({
  default: { template: '<div data-testid="rag-stats">rag stats</div>' }
}))

function mountView() {
  return mount(Statistics)
}

describe('Statistics.vue', () => {
  it('renders the classification tab by default', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Statistics & Analytics')
    expect(wrapper.text()).toContain('🎯 Classification')
    expect(wrapper.text()).toContain('🛡️ Verification')
    expect(wrapper.text()).toContain('🧠 RAG & Embeddings')
    expect(wrapper.find('[data-testid="classification-stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rag-stats"]').exists()).toBe(false)
  })

  it('switches between verification, RAG, and classification tabs', async () => {
    const wrapper = mountView()
    const buttons = wrapper.findAll('button')

    await buttons[1].trigger('click')

    expect(wrapper.find('[data-testid="candidate-bound-verification-stats"]').exists()).toBe(true)
    expect(buttons[1].classes()).toContain('border-blue-500')

    await buttons[2].trigger('click')

    expect(wrapper.find('[data-testid="classification-stats"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rag-stats"]').exists()).toBe(true)
    expect(buttons[2].classes()).toContain('border-blue-500')

    await buttons[0].trigger('click')

    expect(wrapper.find('[data-testid="classification-stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rag-stats"]').exists()).toBe(false)
    expect(buttons[0].classes()).toContain('border-blue-500')
  })
})
