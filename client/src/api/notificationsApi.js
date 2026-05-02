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

export function getNotifications(params = {}) {
  return getDataRequest('/notifications', { params })
}

export function getActiveNotifications() {
  return getDataRequest('/notifications/active')
}

export function getUnreadNotificationCount() {
  return getDataRequest('/notifications/unread-count')
}

export function markNotificationRead(id) {
  return apiClient.post(`/notifications/${id}/read`)
}

export function markNotificationUnread(id) {
  return apiClient.post(`/notifications/${id}/unread`)
}

export function markAllNotificationsRead() {
  return apiClient.post('/notifications/mark-all-read')
}

export function dismissNotification(id) {
  return apiClient.post(`/notifications/${id}/dismiss`)
}

export function deleteNotification(id) {
  return apiClient.post(`/notifications/${id}/delete`)
}

export function clearReadNotifications() {
  return apiClient.post('/notifications/clear-read')
}

export function clearAllNotifications() {
  return apiClient.post('/notifications/clear-all')
}

const notificationsApi = {
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
}

export default notificationsApi
