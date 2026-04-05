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

import { apiClient, getDataRequest } from './core'

export default {
  searchTMDB(query, type = 'multi') {
    return getDataRequest('/requests/search', { params: { q: query, type } })
  },

  submitManualRequest(data) {
    return apiClient.post('/requests/submit', data)
  },

  getRecentManualRequests(limit = 10) {
    return getDataRequest('/requests/recent', { params: { limit } })
  },

  getNotifications(params = {}) {
    return getDataRequest('/notifications', { params })
  },

  getActiveNotifications() {
    return getDataRequest('/notifications/active')
  },

  getUnreadNotificationCount() {
    return getDataRequest('/notifications/unread-count')
  },

  markNotificationRead(id) {
    return apiClient.post(`/notifications/${id}/read`)
  },

  markNotificationUnread(id) {
    return apiClient.post(`/notifications/${id}/unread`)
  },

  markAllNotificationsRead() {
    return apiClient.post('/notifications/mark-all-read')
  },

  dismissNotification(id) {
    return apiClient.post(`/notifications/${id}/dismiss`)
  },

  deleteNotification(id) {
    return apiClient.post(`/notifications/${id}/delete`)
  },

  clearReadNotifications() {
    return apiClient.post('/notifications/clear-read')
  },

  clearAllNotifications() {
    return apiClient.post('/notifications/clear-all')
  },
}
