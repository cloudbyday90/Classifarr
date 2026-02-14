/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

import Header from '@/components/layout/Header.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import CommandCenter from '@/views/CommandCenter.vue'
import appRouter from '@/router'

vi.mock('@vueuse/core', () => ({
  useOnline: () => ({ value: true, __v_isRef: true }),
}))

vi.mock('@/api', () => ({
  default: {
    getLiveStats: vi.fn().mockResolvedValue({ data: { queue: {}, gapAnalysis: {}, enrichment: {}, health: {} } }),
    getClassificationProgress: vi.fn().mockResolvedValue({ data: [] }),
    getQueuePending: vi.fn().mockResolvedValue([]),
    getQueueFailed: vi.fn().mockResolvedValue([]),
    getPendingClassifications: vi.fn().mockResolvedValue({ data: { items: [] } }),
    getOllamaStatus: vi.fn().mockResolvedValue({ data: { isActive: false } }),
    getAIUsage: vi.fn().mockResolvedValue({ data: { budget: { limit: null, used: 0, percentUsed: 0 } } }),
    getLibraries: vi.fn().mockResolvedValue({ data: [] }),
    getLiveFeed: vi.fn().mockResolvedValue({ data: { items: [] } }),
    getMediaServerConfig: vi.fn().mockResolvedValue({ data: null }),
    get: vi.fn().mockResolvedValue({ data: { incompleteConfigs: [] } }),
    cancelQueueTask: vi.fn().mockResolvedValue({}),
    cancelAllPendingTasks: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    processRetryQueue: vi.fn().mockResolvedValue({}),
    resolvePendingClassification: vi.fn().mockResolvedValue({}),
    retryQueueTask: vi.fn().mockResolvedValue({}),
    dismissQueueTask: vi.fn().mockResolvedValue({}),
    retryAllFailedTasks: vi.fn().mockResolvedValue({}),
    clearFailedTasks: vi.fn().mockResolvedValue({}),
    getNotifications: vi.fn().mockResolvedValue({
      data: {
        data: [],
        unreadCount: 0,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      },
    }),
    getUnreadNotificationCount: vi.fn().mockResolvedValue({ data: { unread: 0 } }),
    markAllNotificationsRead: vi.fn().mockResolvedValue({}),
    markNotificationRead: vi.fn().mockResolvedValue({}),
    markNotificationUnread: vi.fn().mockResolvedValue({}),
    dismissNotification: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('/logo.png', () => ({
  default: '/logo.png',
}))

const NAV_ROUTES = [
  { path: '/', component: { template: '<div>Home</div>' } },
  { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
  { path: '/libraries', component: { template: '<div>Libraries</div>' } },
  { path: '/history', component: { template: '<div>History</div>' } },
  { path: '/policies', component: { template: '<div>Policies</div>' } },
  { path: '/presets', component: { template: '<div>Presets</div>' } },
  { path: '/tuning-suggestions', component: { template: '<div>Tuning</div>' } },
  { path: '/statistics', component: { template: '<div>Statistics</div>' } },
  { path: '/policy-stats', component: { template: '<div>Policy Stats</div>' } },
  { path: '/settings', component: { template: '<div>Settings</div>' } },
  { path: '/system', component: { template: '<div>System</div>' } },
  { path: '/activity', component: { template: '<div>Activity</div>' } },
  { path: '/queue', component: { template: '<div>Queue</div>' } },
]

const createTestRouter = async (path = '/') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: NAV_ROUTES,
  })
  await router.push(path)
  await router.isReady()
  return router
}

describe('Command Center shell navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders locked global header controls', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(Header, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Classifarr')
    expect(wrapper.find('button[aria-label="Toggle navigation menu"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Notifications"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Account menu"]').exists()).toBe(true)
  })

  it('renders locked primary sidebar order without exposing legacy nav entries', async () => {
    const router = await createTestRouter('/')
    const wrapper = mount(Sidebar, {
      props: { isOpen: true },
      global: { plugins: [router] },
    })

    const sectionHeaders = wrapper.findAll('.section-header').map((el) => el.text().trim())
    expect(sectionHeaders).toEqual(['Core', 'Classification', 'Insights', 'Admin'])

    const linkLabels = wrapper.findAll('a').map((el) => el.text().trim()).filter(Boolean)
    expect(linkLabels).toEqual([
      'Command Center',
      'Libraries',
      'History',
      'Policies',
      'Presets',
      'Tuning',
      'Statistics',
      'Policy Stats',
      'Settings',
      'System',
    ])

    expect(wrapper.text()).not.toContain('Request')
    expect(wrapper.text()).not.toContain('Migration')
    expect(wrapper.text()).not.toContain('Activity')
    expect(wrapper.text()).not.toContain('Queue')
  })

  it('renders locked command center anchors with optional alert/enrichment visibility', async () => {
    const router = await createTestRouter('/')
    const wrapper = mount(CommandCenter, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    })

    const alwaysVisibleAnchors = [
      'processing',
      'needs-attention',
      'errors',
      'recently-completed',
      'quick-add',
      'libraries',
      'today',
    ]

    for (const anchor of alwaysVisibleAnchors) {
      expect(wrapper.find(`#${anchor}`).exists()).toBe(true)
    }

    expect(wrapper.find('#alerts').exists()).toBe(false)
    expect(wrapper.find('#enrichment').exists()).toBe(false)
  })

  it('defines explicit route behavior metadata for primary and compatibility pages', () => {
    const layoutRoute = appRouter.options.routes.find((route) => route.path === '/')
    const children = layoutRoute.children

    const getByPath = (path) => children.find((route) => route.path === path)

    expect(getByPath('').name).toBe('CommandCenter')
    expect(getByPath('').meta.routeMode).toBe('primary')

    expect(getByPath('/dashboard').meta.routeMode).toBe('compatibility-only')
    expect(getByPath('/activity').meta.routeMode).toBe('compatibility-only')
    expect(getByPath('/queue').meta.routeMode).toBe('compatibility-only')
    expect(getByPath('/request').meta.routeMode).toBe('compatibility-only')
    expect(getByPath('/migration').meta.routeMode).toBe('deprecated-compatibility')
  })

  it('redirects legacy compatibility routes to command center with guidance context', () => {
    const layoutRoute = appRouter.options.routes.find((route) => route.path === '/')
    const children = layoutRoute.children
    const getByPath = (path) => children.find((route) => route.path === path)

    const dashboardRedirect = getByPath('/dashboard').redirect({ query: {} })
    expect(dashboardRedirect).toMatchObject({
      path: '/',
      query: { legacyRoute: 'dashboard' },
    })

    const activityRedirect = getByPath('/activity').redirect({ query: {} })
    expect(activityRedirect).toMatchObject({
      path: '/',
      hash: '#processing',
      query: { legacyRoute: 'activity' },
    })

    const queueRedirect = getByPath('/queue').redirect({ query: {} })
    expect(queueRedirect).toMatchObject({
      path: '/',
      hash: '#processing',
      query: { legacyRoute: 'queue' },
    })

    const migrationRedirect = getByPath('/migration').redirect({ query: {} })
    expect(migrationRedirect).toMatchObject({
      path: '/',
      query: { legacyRoute: 'migration' },
    })
  })

  it('resolves the compatibility route matrix to valid route records', () => {
    const routeMatrix = ['/', '/dashboard', '/activity', '/queue', '/history']
    for (const path of routeMatrix) {
      const resolved = appRouter.resolve(path)
      expect(resolved.matched.length).toBeGreaterThan(0)
    }
  })

  it('keeps exactly one active nav item through compatibility route transitions', async () => {
    const router = await createTestRouter('/')
    const wrapper = mount(Sidebar, {
      props: { isOpen: true },
      global: { plugins: [router] },
    })

    const pathsToCheck = ['/', '/dashboard', '/libraries', '/history', '/policies', '/settings']
    for (const path of pathsToCheck) {
      await router.push(path)
      const activeLinks = wrapper.findAll('.nav-item.active')
      expect(activeLinks.length).toBe(1)
    }
  })

  it('exposes keyboard-focusable controls in header and sidebar shells', async () => {
    const router = await createTestRouter('/')

    const header = mount(Header, {
      global: { plugins: [router] },
    })
    const sidebar = mount(Sidebar, {
      props: { isOpen: true },
      global: { plugins: [router] },
    })

    const focusables = [
      ...header.findAll('button, a'),
      ...sidebar.findAll('button, a'),
    ]

    expect(focusables.length).toBeGreaterThan(0)
    for (const node of focusables) {
      expect(node.attributes('tabindex')).not.toBe('-1')
    }
  })

  it('does not emit console errors during compatibility route transitions', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = await createTestRouter('/')
    mount(Sidebar, {
      props: { isOpen: true },
      global: { plugins: [router] },
    })

    const pathsToCheck = ['/', '/dashboard', '/activity', '/queue', '/history']
    for (const path of pathsToCheck) {
      await router.push(path)
    }

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
