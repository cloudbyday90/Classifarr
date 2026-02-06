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
import { createRouter, createMemoryHistory } from 'vue-router'

import RAGSettings from '../views/RAGSettings.vue'
import api from '../api'

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
  },
}))

const mockApiGet = (overrides = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/api/rag/status') {
      return Promise.resolve({
        data: {
          providerOnline: true,
          stats: { total: 123 },
          image: { providerOnline: true, stats: { total: 456 } },
          ...overrides.status,
        }
      })
    }
    if (url === '/api/rag/backfill/status') {
      return Promise.resolve({
        data: {
          pendingBreakdown: { text: 0, image: 0 },
          ...overrides.backfill,
        }
      })
    }
    if (url === '/api/system/heartbeat') {
      return Promise.resolve({
        data: { active: true, ...overrides.heartbeat }
      })
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`))
  })
}

describe('RAGSettings nested tab persistence', () => {
  let router

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet()

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/settings', component: RAGSettings },
      ],
    })
  })

  it('uses ?ragTab= without clobbering Settings ?tab=', async () => {
    await router.push('/settings?tab=rag&ragTab=text')
    await router.isReady()

    const wrapper = mount(RAGSettings, {
      global: {
        plugins: [router],
        // Stub child tab components; this test only validates router/query behavior.
        stubs: {
          OverviewTab: { template: '<div />' },
          TextEmbeddingsTab: { template: '<div />' },
          ImageEmbeddingsTab: { template: '<div />' },
          BackfillTab: { template: '<div />' },
          AdvancedTab: { template: '<div />' },
        }
      }
    })

    await flushPromises()

    // Click "Image Embeddings" and confirm query updates `ragTab` only.
    const imageBtn = wrapper.findAll('button').find(b => b.text().includes('Image Embeddings'))
    await imageBtn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.tab).toBe('rag')
    expect(router.currentRoute.value.query.ragTab).toBe('images')

    // Switch back to Overview: should remove ragTab but keep tab=rag
    const overviewBtn = wrapper.findAll('button').find(b => b.text().includes('Overview'))
    await overviewBtn.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.tab).toBe('rag')
    expect(router.currentRoute.value.query.ragTab).toBeUndefined()

    wrapper.unmount()
  })
})

