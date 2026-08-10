/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const apiMock = {
  getSetupStatus: vi.fn(),
  getMe: vi.fn()
}

vi.mock('@/api', () => ({
  default: apiMock
}))

vi.mock('@/components/layout/MainLayout.vue', () => ({
  default: { template: '<div><router-view /></div>' }
}))

async function loadRouter() {
  vi.resetModules()
  const module = await import('@/router/index.js')
  return module.default
}

describe('router auth/setup guard', () => {
  let consoleErrorSpy

  beforeEach(() => {
    vi.resetAllMocks()
    window.history.replaceState({}, '', '/')
    apiMock.getSetupStatus.mockResolvedValue({ setupRequired: false })
    apiMock.getMe.mockResolvedValue({ data: { id: 1 } })
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('redirects protected routes to setup-account when setup is required', async () => {
    apiMock.getSetupStatus.mockResolvedValueOnce({ setupRequired: true })

    const router = await loadRouter()
    await router.push('/settings')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('SetupAccount')
    expect(apiMock.getMe).not.toHaveBeenCalled()
  })

  it('allows the setup-account route when setup is required', async () => {
    apiMock.getSetupStatus.mockResolvedValueOnce({ setupRequired: true })

    const router = await loadRouter()
    await router.push('/setup-account')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('SetupAccount')
  })

  it('always allows the setup wizard route without calling setup or auth checks', async () => {
    const router = await loadRouter()
    await router.push('/setup')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('SetupWizard')
    expect(apiMock.getSetupStatus).not.toHaveBeenCalled()
    expect(apiMock.getMe).not.toHaveBeenCalled()
  })

  it('allows the login route without calling getMe once setup is complete', async () => {
    const router = await loadRouter()
    await router.push('/login')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Login')
    expect(apiMock.getMe).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated users to login with a redirect query', async () => {
    apiMock.getMe.mockRejectedValueOnce(new Error('expired'))

    const router = await loadRouter()
    await router.push('/statistics')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Login')
    expect(router.currentRoute.value.query.redirect).toBe('/statistics')
  })

  it('allows authenticated navigation to protected routes', async () => {
    const router = await loadRouter()
    await router.push('/statistics')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Statistics')
    expect(apiMock.getSetupStatus).toHaveBeenCalled()
    expect(apiMock.getMe).toHaveBeenCalledTimes(1)
  })

  it('allows authenticated administrators to reach native intent reconciliation status', async () => {
    const router = await loadRouter()

    await router.push('/policies/native-intent-reconciliation')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('PolicyNativeIntentReconciliation')
    expect(router.resolve('/policies/native-intent-migration').matched).toHaveLength(0)
  })

  it('allows authenticated administrators to reach historic route-safety maintenance', async () => {
    const router = await loadRouter()

    await router.push('/policies/historic-route-safety-refresh')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('PolicyHistoricRouteSafetyRefresh')
  })

  it('logs setup-status failures and still allows navigation', async () => {
    apiMock.getSetupStatus.mockRejectedValueOnce(new Error('setup offline'))

    const router = await loadRouter()
    await router.push('/libraries')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Libraries')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to check setup status:', expect.any(Error))
  })

  it('preserves legacy metadata when redirecting dashboard routes', async () => {
    const router = await loadRouter()
    await router.push('/dashboard?tab=overview')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.query.tab).toBe('overview')
    expect(router.currentRoute.value.query.legacyRoute).toBe('dashboard')
  })

  it('redirects queue and activity routes to the processing hash', async () => {
    const router = await loadRouter()

    await router.push('/queue?scope=pending')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.hash).toBe('#processing')
    expect(router.currentRoute.value.query.scope).toBe('pending')
    expect(router.currentRoute.value.query.legacyRoute).toBe('queue')

    await router.push('/activity?scope=history')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.hash).toBe('#processing')
    expect(router.currentRoute.value.query.scope).toBe('history')
    expect(router.currentRoute.value.query.legacyRoute).toBe('activity')
  })

  it('redirects migration routes back to the command center', async () => {
    const router = await loadRouter()
    await router.push('/migration?from=v1')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.query.from).toBe('v1')
    expect(router.currentRoute.value.query.legacyRoute).toBe('migration')
  })
})
