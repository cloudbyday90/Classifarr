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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from '../App.vue';
import api from '@/api'

const mockRoute = vi.hoisted(() => ({ name: 'CommandCenter' }))

// Mock the API
vi.mock('@/api', () => ({
  default: {
    getSystemHealth: vi.fn()
  }
}))

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

describe('App.vue', () => {
  let wrappers

  beforeEach(() => {
    wrappers = []
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockRoute.name = 'CommandCenter'
    // Mock the API response
    api.getSystemHealth.mockResolvedValue({
      database: 'connected',
      mediaServer: 'not_configured',
      radarr: 'not_configured',
      sonarr: 'not_configured',
      ollama: 'not_configured',
      tmdb: 'not_configured',
      omdb: 'not_configured',
      discordBot: 'not_configured',
      tavily: 'not_configured',
      queueWorker: 'healthy',
      details: {}
    })
  })

  afterEach(() => {
    for (const wrapper of wrappers) {
      wrapper.unmount()
    }
  })

  function mountApp() {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: {
          RouterView: true,
          Toast: true
        }
      }
    })
    wrappers.push(wrapper)
    return wrapper
  }

  it('renders without crashing', () => {
    const wrapper = mountApp();
    expect(wrapper.exists()).toBe(true);
  });

  it('contains router-view component', () => {
    const wrapper = mountApp();
    expect(wrapper.findComponent({ name: 'RouterView' }).exists()).toBe(true);
  });

  it('contains Toast component', () => {
    const wrapper = mountApp();
    expect(wrapper.findComponent({ name: 'Toast' }).exists()).toBe(true);
  });

  it.each(['Login', 'SetupAccount', 'SetupWizard'])('does not poll authenticated health on %s route', async (routeName) => {
    mockRoute.name = routeName

    mountApp()

    expect(api.getSystemHealth).not.toHaveBeenCalled()
  })
});
