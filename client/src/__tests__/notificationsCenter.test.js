/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import Header from '@/components/layout/Header.vue'
import NotificationsView from '@/views/Notifications.vue'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    getNotifications: vi.fn(),
    getUnreadNotificationCount: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    markNotificationRead: vi.fn(),
    markNotificationUnread: vi.fn(),
    dismissNotification: vi.fn(),
    clearReadNotifications: vi.fn(),
  },
}))

vi.mock('@/api', () => ({
  default: apiMock,
}))

const buildNotificationsPayload = () => ({
  data: [
    {
      id: 900,
      type: 'awaiting_decision',
      title: '2 items awaiting decision',
      message: 'The Bear S03, Oppenheimer',
      severity: 'warning',
      isRead: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      readAt: null,
      targetPath: '/',
      targetAnchor: 'needs-attention',
      actionMeta: null,
      dismissible: true,
    },
    {
      id: 901,
      type: 'sync_completed',
      title: 'Library sync completed',
      message: '4K Movies: +12 items',
      severity: 'success',
      isRead: true,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      readAt: new Date().toISOString(),
      targetPath: '/',
      targetAnchor: 'libraries',
      actionMeta: null,
      dismissible: true,
    },
  ],
  unreadCount: 1,
  pagination: {
    page: 1,
    limit: 25,
    total: 2,
    totalPages: 1,
  },
})

async function createRouterForNotifications(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/notifications', component: { template: '<div>Notifications</div>' } },
      { path: '/history', component: { template: '<div>History</div>' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return router
}

describe('Notifications center UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getNotifications.mockResolvedValue({ data: buildNotificationsPayload() })
    apiMock.getUnreadNotificationCount.mockResolvedValue({ data: { unread: 1 } })
    apiMock.get.mockResolvedValue({ data: { username: 'admin', role: 'admin' } })
    apiMock.post.mockResolvedValue({ data: { success: true } })
    apiMock.markAllNotificationsRead.mockResolvedValue({ data: { updated: 1 } })
    apiMock.markNotificationRead.mockResolvedValue({ data: { success: true } })
    apiMock.markNotificationUnread.mockResolvedValue({ data: { success: true } })
    apiMock.dismissNotification.mockResolvedValue({ data: { success: true } })
    apiMock.clearReadNotifications.mockResolvedValue({ data: { cleared: 1 } })
  })

  it('renders unread badge and notifications panel from live API data', async () => {
    const router = await createRouterForNotifications('/')
    const wrapper = mount(Header, {
      global: { plugins: [router] },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('1')

    const bellButton = wrapper.find('button[aria-label="Notifications"]')
    await bellButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('NOTIFICATIONS')
    expect(wrapper.text()).toContain('2 items awaiting decision')
    expect(wrapper.text()).toContain('Library sync completed')
  })

  it('supports mark-all-read and routes to full notifications page', async () => {
    const router = await createRouterForNotifications('/')
    const wrapper = mount(Header, {
      global: { plugins: [router] },
    })

    await flushPromises()
    await wrapper.find('button[aria-label="Notifications"]').trigger('click')
    await flushPromises()

    const markAllButton = wrapper.findAll('button').find((node) => node.text() === 'Mark All Read')
    expect(markAllButton).toBeDefined()
    await markAllButton.trigger('click')
    await flushPromises()
    expect(apiMock.markAllNotificationsRead).toHaveBeenCalledTimes(1)

    const viewAllButton = wrapper.findAll('button').find((node) => node.text() === 'View All Notifications')
    expect(viewAllButton).toBeDefined()
    await viewAllButton.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/notifications')
  })

  it('supports open and bulk actions in /notifications full view', async () => {
    const router = await createRouterForNotifications('/notifications')
    const wrapper = mount(NotificationsView, {
      global: { plugins: [router] },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('NOTIFICATIONS')
    expect(wrapper.text()).toContain('2 items awaiting decision')

    const markAllButton = wrapper.findAll('button').find((node) => node.text() === 'Mark All Read')
    expect(markAllButton).toBeDefined()
    await markAllButton.trigger('click')
    await flushPromises()
    expect(apiMock.markAllNotificationsRead).toHaveBeenCalledTimes(1)

    const clearReadButton = wrapper.findAll('button').find((node) => node.text() === 'Clear Read')
    expect(clearReadButton).toBeDefined()
    await clearReadButton.trigger('click')
    await flushPromises()
    expect(apiMock.clearReadNotifications).toHaveBeenCalledTimes(1)

    const openButton = wrapper.findAll('button').find((node) => node.text() === 'Open')
    expect(openButton).toBeDefined()
    await openButton.trigger('click')
    await flushPromises()
    expect(apiMock.markNotificationRead).toHaveBeenCalled()
    expect(router.currentRoute.value.hash).toBe('#needs-attention')
  })

  it('applies filter changes when switching to unread view', async () => {
    const router = await createRouterForNotifications('/notifications')
    const wrapper = mount(NotificationsView, {
      global: { plugins: [router] },
    })

    await flushPromises()
    const unreadFilter = wrapper.findAll('button').find((node) => node.text() === 'Unread')
    expect(unreadFilter).toBeDefined()
    await unreadFilter.trigger('click')
    await flushPromises()

    const calls = apiMock.getNotifications.mock.calls.map((args) => args[0] || {})
    expect(calls.some((params) => params.filter === 'unread')).toBe(true)
  })

  it('applies sort changes when switching to oldest first', async () => {
    const router = await createRouterForNotifications('/notifications')
    const wrapper = mount(NotificationsView, {
      global: { plugins: [router] },
    })

    await flushPromises()
    const sortSelect = wrapper.find('#notifications-sort')
    await sortSelect.setValue('oldest')
    await flushPromises()

    const calls = apiMock.getNotifications.mock.calls.map((args) => args[0] || {})
    expect(calls.some((params) => params.sort === 'oldest')).toBe(true)
  })

  it('persists read-state across remount and keeps open-target routing behavior', async () => {
    let readPersisted = false
    apiMock.getNotifications.mockImplementation(async () => ({
      data: {
        ...buildNotificationsPayload(),
        data: [{
          id: 902,
          type: 'awaiting_decision',
          title: '2 items awaiting decision',
          message: 'The Bear S03, Oppenheimer',
          severity: 'warning',
          isRead: readPersisted,
          createdAt: new Date(Date.now() - 120000).toISOString(),
          readAt: readPersisted ? new Date().toISOString() : null,
          targetPath: '/',
          targetAnchor: 'needs-attention',
          actionMeta: null,
          dismissible: true,
        }],
        unreadCount: readPersisted ? 0 : 1,
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      },
    }))
    apiMock.getUnreadNotificationCount.mockImplementation(async () => ({
      data: { unread: readPersisted ? 0 : 1 },
    }))
    apiMock.markNotificationRead.mockImplementation(async () => {
      readPersisted = true
      return { data: { success: true } }
    })

    const router1 = await createRouterForNotifications('/')
    const firstSession = mount(Header, { global: { plugins: [router1] } })
    await flushPromises()

    expect(firstSession.text()).toContain('1')
    await firstSession.find('button[aria-label="Notifications"]').trigger('click')
    await flushPromises()

    const openButton = firstSession.findAll('button').find((node) => node.text() === 'Open')
    expect(openButton).toBeDefined()
    await openButton.trigger('click')
    await flushPromises()
    expect(router1.currentRoute.value.hash).toBe('#needs-attention')
    firstSession.unmount()

    const router2 = await createRouterForNotifications('/')
    const secondSession = mount(Header, { global: { plugins: [router2] } })
    await flushPromises()

    expect(secondSession.text()).not.toContain('1')
    await secondSession.find('button[aria-label="Notifications"]').trigger('click')
    await flushPromises()
    expect(secondSession.text()).toContain('Mark Unread')
  })

  it('routes notification opens to each locked command center anchor target', async () => {
    const anchors = [
      'alerts',
      'processing',
      'enrichment',
      'needs-attention',
      'errors',
      'recently-completed',
      'quick-add',
      'libraries',
      'today',
    ]

    for (const anchor of anchors) {
      apiMock.getNotifications.mockResolvedValueOnce({
        data: {
          data: [{
            id: Math.floor(Math.random() * 100000),
            type: 'update_available',
            title: `Anchor test ${anchor}`,
            message: `Go to ${anchor}`,
            severity: 'info',
            isRead: false,
            createdAt: new Date().toISOString(),
            readAt: null,
            targetPath: '/',
            targetAnchor: anchor,
            actionMeta: null,
            dismissible: true,
          }],
          unreadCount: 1,
          pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
        },
      })

      const router = await createRouterForNotifications('/notifications')
      const wrapper = mount(NotificationsView, {
        global: { plugins: [router] },
      })
      await flushPromises()

      const openButton = wrapper.findAll('button').find((node) => node.text() === 'Open')
      expect(openButton).toBeDefined()
      await openButton.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.hash).toBe(`#${anchor}`)
      wrapper.unmount()
    }
  })

  it('keeps stable row counts across repeated revalidation-triggering actions', async () => {
    const router = await createRouterForNotifications('/notifications')
    const wrapper = mount(NotificationsView, {
      global: { plugins: [router] },
    })

    await flushPromises()
    expect(wrapper.findAll('article').length).toBe(2)

    const unreadFilter = wrapper.findAll('button').find((node) => node.text() === 'Unread')
    expect(unreadFilter).toBeDefined()
    await unreadFilter.trigger('click')
    await flushPromises()

    const allFilter = wrapper.findAll('button').find((node) => node.text() === 'All')
    expect(allFilter).toBeDefined()
    await allFilter.trigger('click')
    await flushPromises()

    const sortSelect = wrapper.find('#notifications-sort')
    await sortSelect.setValue('oldest')
    await flushPromises()
    await sortSelect.setValue('newest')
    await flushPromises()

    expect(wrapper.findAll('article').length).toBe(2)
  })

  it('does not emit console errors during high-frequency notification interactions', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = await createRouterForNotifications('/notifications')
    const wrapper = mount(NotificationsView, {
      global: { plugins: [router] },
    })

    await flushPromises()

    const markAllButton = wrapper.findAll('button').find((node) => node.text() === 'Mark All Read')
    const clearReadButton = wrapper.findAll('button').find((node) => node.text() === 'Clear Read')
    expect(markAllButton).toBeDefined()
    expect(clearReadButton).toBeDefined()

    await markAllButton.trigger('click')
    await clearReadButton.trigger('click')
    await markAllButton.trigger('click')
    await flushPromises()

    const toggleButton = wrapper.findAll('button').find((node) => node.text().includes('Mark '))
    expect(toggleButton).toBeDefined()
    await toggleButton.trigger('click')
    await toggleButton.trigger('click')
    await flushPromises()

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
