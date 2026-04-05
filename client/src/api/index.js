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

import adminApi from './admin'
import classificationApi from './classification'
import evidenceApi from './evidence'
import { apiClient, getDataRequest, getSettingsRequest, updateSettingsRequest } from './core'
import librariesApi from './libraries'
import mediaServerApi from './mediaServer'
import queueApi from './queue'
import ragApi from './rag'
import requestsNotificationsApi from './requestsNotifications'
import settingsApi from './settings'
import statsApi from './stats'
import systemApi from './system'

export default {
  login(identifier, password, rememberMe = false) {
    return apiClient.post('/auth/login', { identifier, password, rememberMe })
  },

  logout() {
    // Refresh token is cleared server-side; cookie cleared via Set-Cookie response header
    return apiClient.post('/auth/logout', {})
  },

  logoutAll() {
    return apiClient.post('/auth/logout-all')
  },

  getMe() {
    return apiClient.get('/auth/me')
  },

  clearAuth() {
    // Session state is managed server-side via httpOnly cookies — no client-side cleanup needed
  },

  get(url, config) {
    return apiClient.get(url, config)
  },
  getData(url, config) {
    return getDataRequest(url, config)
  },
  post(url, data, config) {
    return apiClient.post(url, data, config)
  },
  put(url, data, config) {
    return apiClient.put(url, data, config)
  },
  patch(url, data, config) {
    return apiClient.patch(url, data, config)
  },
  delete(url, config) {
    return apiClient.delete(url, config)
  },

  getSettings(category = null) {
    return getSettingsRequest(category)
  },
  updateSettings(categoryOrSettings, settings = null) {
    return updateSettingsRequest(categoryOrSettings, settings)
  },

  ...mediaServerApi,

  ...librariesApi,
  ...classificationApi,
  ...settingsApi,
  ...statsApi,
  ...ragApi,
  ...requestsNotificationsApi,
  ...systemApi,
  ...adminApi,

  ...evidenceApi,

  ...queueApi,
}
