/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useCommandCenterShell } from '@/composables/useCommandCenterShell'

function mockMatchMedia(matches = false, useLegacy = false) {
  const mediaQueryList = {
    matches,
    media: '(max-width: 1023px)',
    onchange: null,
    addEventListener: useLegacy ? undefined : vi.fn(),
    removeEventListener: useLegacy ? undefined : vi.fn(),
    addListener: useLegacy ? vi.fn() : undefined,
    removeListener: useLegacy ? vi.fn() : undefined,
    dispatchEvent: vi.fn(),
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mediaQueryList),
  })

  return mediaQueryList
}

function mountShell({ route, router }) {
  let shell

  const TestComponent = defineComponent({
    setup() {
      shell = useCommandCenterShell({ route, router })
      return shell
    },
    template: '<div />',
  })

  const wrapper = mount(TestComponent)
  return { shell, wrapper }
}

describe('useCommandCenterShell composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds legacy-route guidance and clears it on dismiss', async () => {
    mockMatchMedia(false)
    const route = {
      path: '/',
      hash: '',
      query: { legacyRoute: 'queue' },
    }
    const router = {
      replace: vi.fn(),
    }

    const { shell, wrapper } = mountShell({ route, router })

    expect(shell.legacyRouteNotice.value?.message).toContain('You were redirected from Queue.')
    expect(shell.legacyRouteNotice.value?.actions).toHaveLength(2)

    shell.dismissLegacyRouteNotice()

    expect(router.replace).toHaveBeenCalledWith({ path: '/', hash: '', query: {} })
    wrapper.unmount()
  })

  it('toggles section expansion state and tracks mobile viewport setup', async () => {
    const mediaQueryList = mockMatchMedia(true)
    const route = {
      path: '/',
      hash: '',
      query: {},
    }
    const router = {
      replace: vi.fn(),
    }

    const { shell, wrapper } = mountShell({ route, router })

    expect(shell.isMobileViewport.value).toBe(true)
    expect(shell.expandedSections.value.quickadd).toBe(false)

    shell.toggleSection('quickadd')
    await nextTick()

    expect(shell.expandedSections.value.quickadd).toBe(true)
    expect(mediaQueryList.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    wrapper.unmount()

    expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('falls back cleanly for unknown legacy routes', () => {
    mockMatchMedia(false)
    const route = {
      path: '/',
      hash: '',
      query: { legacyRoute: 'unknown' },
    }
    const router = {
      replace: vi.fn(),
    }

    const { shell, wrapper } = mountShell({ route, router })

    expect(shell.legacyRouteNotice.value).toBeNull()
    wrapper.unmount()
  })

  it('builds correct notice for activity, migration, and dashboard legacy routes', () => {
    mockMatchMedia(false)

    const activityShell = mountShell({
      route: { path: '/', hash: '', query: { legacyRoute: 'activity' } },
      router: { replace: vi.fn() },
    })
    expect(activityShell.shell.legacyRouteNotice.value.message).toContain('Live Activity')
    expect(activityShell.shell.legacyRouteNotice.value.actions).toHaveLength(2)
    activityShell.wrapper.unmount()

    const migrationShell = mountShell({
      route: { path: '/', hash: '', query: { legacyRoute: 'migration' } },
      router: { replace: vi.fn() },
    })
    expect(migrationShell.shell.legacyRouteNotice.value.message).toContain('deprecated')
    expect(migrationShell.shell.legacyRouteNotice.value.actions).toHaveLength(3)
    migrationShell.wrapper.unmount()

    const dashboardShell = mountShell({
      route: { path: '/', hash: '', query: { legacyRoute: 'dashboard' } },
      router: { replace: vi.fn() },
    })
    expect(dashboardShell.shell.legacyRouteNotice.value.message).toContain('Dashboard')
    expect(dashboardShell.shell.legacyRouteNotice.value.actions).toHaveLength(2)
    dashboardShell.wrapper.unmount()
  })

  it('falls back to addListener/removeListener when addEventListener is unavailable', async () => {
    const mediaQueryList = mockMatchMedia(true, true)
    const route = { path: '/', hash: '', query: {} }
    const router = { replace: vi.fn() }

    const { shell, wrapper } = mountShell({ route, router })

    expect(mediaQueryList.addListener).toHaveBeenCalledWith(expect.any(Function))

    wrapper.unmount()

    expect(mediaQueryList.removeListener).toHaveBeenCalledWith(expect.any(Function))
  })
})
