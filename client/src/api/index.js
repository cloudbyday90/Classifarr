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
import { apiClient } from './core'
import librariesApi from './libraries'
import libraryMappingsApi from './libraryMappingsApi'
import logsApi from './logsApi'
import mediaServerApi from './mediaServer'
import policiesApi from './policiesApi'
import queueApi from './queue'
import ragApi from './rag'
import ratingNormalizationApi from './ratingNormalizationApi'
import notificationsApi from './notificationsApi'
import requestsApi from './requestsApi'
import settingsApi from './settings'
import statsApi from './stats'
import systemApi from './system'
import userApi from './userApi'

export default {
  login(identifier, password, rememberMe = false) {
    return apiClient.post('/auth/login', { identifier, password, rememberMe })
  },

  getMe() {
    return apiClient.get('/auth/me')
  },

  logout(refreshToken) {
    return apiClient.post('/auth/logout', { refreshToken })
  },

  createAdmin(data) {
    return apiClient.post('/setup/create-admin', data)
  },

  ...mediaServerApi,

  ...librariesApi,
  ...libraryMappingsApi,
  ...classificationApi,
  ...policiesApi,
  ...settingsApi,
  ...statsApi,
  ...ragApi,
  ...requestsApi,
  ...notificationsApi,
  ...logsApi,
  ...ratingNormalizationApi,
  ...systemApi,
  ...adminApi,
  ...userApi,

  ...evidenceApi,

  ...queueApi,
}
