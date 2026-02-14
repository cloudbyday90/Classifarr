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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MappingWarningBanner from '../components/MappingWarningBanner.vue'
import api from '../api'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api', () => ({
  default: {
    getActiveNotifications: vi.fn(),
    dismissNotification: vi.fn(),
  },
}))

describe('MappingWarningBanner.vue', () => {
  let router

  beforeEach(() => {
    vi.clearAllMocks()
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/settings', component: { template: '<div>Settings</div>' } },
      ],
    })
  })

  function mountBanner() {
    return mount(MappingWarningBanner, {
      global: {
        plugins: [router],
        stubs: {
          Button: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
            props: ['size', 'variant'],
          },
        },
      },
    })
  }

  const mappingWarning = {
    id: 1,
    severity: 'warning',
    title: 'Library Mapping Warning',
    message: 'Some mappings could not be restored',
  }

  it('renders when hasWarning is true', async () => {
    api.getActiveNotifications.mockResolvedValueOnce({ data: [mappingWarning] })
    const wrapper = mountBanner()
    await flushPromises()

    expect(wrapper.find('.bg-warning\\/10').exists()).toBe(true)
    expect(wrapper.text()).toContain('Library Mapping Warning')
    expect(wrapper.text()).toContain('Some mappings could not be restored')
  })

  it('does not render when hasWarning is false', async () => {
    api.getActiveNotifications.mockResolvedValueOnce({ data: [] })
    const wrapper = mountBanner()
    await flushPromises()

    expect(wrapper.find('.bg-warning\\/10').exists()).toBe(false)
  })

  it('fetches notifications on mount', async () => {
    api.getActiveNotifications.mockResolvedValueOnce({ data: [] })
    mountBanner()
    await flushPromises()
    expect(api.getActiveNotifications).toHaveBeenCalled()
  })

  it('handles 404 errors silently', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.getActiveNotifications.mockRejectedValueOnce({ response: { status: 404 } })
    const wrapper = mountBanner()
    await flushPromises()

    expect(consoleWarn).not.toHaveBeenCalled()
    expect(wrapper.find('.bg-warning\\/10').exists()).toBe(false)
    consoleWarn.mockRestore()
  })

  it('logs non-404 errors', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.getActiveNotifications.mockRejectedValueOnce({ response: { status: 500 } })
    mountBanner()
    await flushPromises()
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })

  it('dismisses notification successfully', async () => {
    api.getActiveNotifications.mockResolvedValueOnce({ data: [mappingWarning] })
    api.dismissNotification.mockResolvedValueOnce({})
    const wrapper = mountBanner()
    await flushPromises()

    const dismissButton = wrapper.findAll('button').find((b) => b.text().includes('Dismiss'))
    await dismissButton.trigger('click')

    expect(api.dismissNotification).toHaveBeenCalledWith(1)
    expect(wrapper.find('.bg-warning\\/10').exists()).toBe(false)
  })

  it('navigates to Radarr settings', async () => {
    api.getActiveNotifications.mockResolvedValueOnce({ data: [mappingWarning] })
    const wrapper = mountBanner()
    await flushPromises()

    const radarrButton = wrapper.findAll('button').find((b) => b.text().includes('Configure Radarr'))
    await radarrButton.trigger('click')
    await flushPromises()
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/settings')
    expect(router.currentRoute.value.query.tab).toBe('radarr')
  })

  it('navigates to Sonarr settings', async () => {
    api.getActiveNotifications.mockResolvedValueOnce({ data: [mappingWarning] })
    const wrapper = mountBanner()
    await flushPromises()

    const sonarrButton = wrapper.findAll('button').find((b) => b.text().includes('Configure Sonarr'))
    await sonarrButton.trigger('click')
    await flushPromises()
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/settings')
    expect(router.currentRoute.value.query.tab).toBe('sonarr')
  })

  it('hides banner locally even if dismiss API fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.getActiveNotifications.mockResolvedValueOnce({ data: [mappingWarning] })
    api.dismissNotification.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mountBanner()
    await flushPromises()

    const dismissButton = wrapper.findAll('button').find((b) => b.text().includes('Dismiss'))
    await dismissButton.trigger('click')

    expect(consoleError).toHaveBeenCalled()
    expect(wrapper.find('.bg-warning\\/10').exists()).toBe(false)
    consoleError.mockRestore()
  })
})
