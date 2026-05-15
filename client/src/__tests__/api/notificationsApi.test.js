import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  getNotifications,
  getActiveNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  dismissNotification,
  deleteNotification,
  clearReadNotifications,
  clearAllNotifications,
} from '../../api/notificationsApi'

describe('notificationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getNotifications calls getDataRequest with empty default params', async () => {
    const data = { data: [], unreadCount: 0 }
    mockGetDataRequest.mockResolvedValueOnce(data)
    const result = await getNotifications()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/notifications', { params: {} })
    expect(result).toEqual(data)
  })

  it('getNotifications passes provided params', async () => {
    mockGetDataRequest.mockResolvedValueOnce({})
    await getNotifications({ unread: true, page: 2 })
    expect(mockGetDataRequest).toHaveBeenCalledWith('/notifications', { params: { unread: true, page: 2 } })
  })

  it('getActiveNotifications calls getDataRequest with /notifications/active', async () => {
    const active = [{ id: 1, message: 'Alert' }]
    mockGetDataRequest.mockResolvedValueOnce(active)
    const result = await getActiveNotifications()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/notifications/active')
    expect(result).toEqual(active)
  })

  it('getUnreadNotificationCount calls getDataRequest with correct URL', async () => {
    mockGetDataRequest.mockResolvedValueOnce({ unread: 5 })
    const result = await getUnreadNotificationCount()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/notifications/unread-count')
    expect(result).toEqual({ unread: 5 })
  })

  it('markNotificationRead calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { ok: true } })
    const result = await markNotificationRead(3)
    expect(mockPost).toHaveBeenCalledWith('/notifications/3/read')
    expect(result).toEqual({ data: { ok: true } })
  })

  it('markNotificationUnread calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { ok: true } })
    const result = await markNotificationUnread(3)
    expect(mockPost).toHaveBeenCalledWith('/notifications/3/unread')
    expect(result).toEqual({ data: { ok: true } })
  })

  it('markAllNotificationsRead calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { updated: 10 } })
    const result = await markAllNotificationsRead()
    expect(mockPost).toHaveBeenCalledWith('/notifications/mark-all-read')
    expect(result).toEqual({ data: { updated: 10 } })
  })

  it('dismissNotification calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { dismissed: true } })
    const result = await dismissNotification(7)
    expect(mockPost).toHaveBeenCalledWith('/notifications/7/dismiss')
    expect(result).toEqual({ data: { dismissed: true } })
  })

  it('deleteNotification calls POST with id in URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { deleted: true } })
    const result = await deleteNotification(9)
    expect(mockPost).toHaveBeenCalledWith('/notifications/9/delete')
    expect(result).toEqual({ data: { deleted: true } })
  })

  it('clearReadNotifications calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { cleared: 15 } })
    const result = await clearReadNotifications()
    expect(mockPost).toHaveBeenCalledWith('/notifications/clear-read')
    expect(result).toEqual({ data: { cleared: 15 } })
  })

  it('clearAllNotifications calls POST with correct URL', async () => {
    mockPost.mockResolvedValueOnce({ data: { cleared: 30 } })
    const result = await clearAllNotifications()
    expect(mockPost).toHaveBeenCalledWith('/notifications/clear-all')
    expect(result).toEqual({ data: { cleared: 30 } })
  })
})
