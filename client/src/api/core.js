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

import axios from 'axios'

const CSRF_COOKIE_NAME = 'classifarr_csrf_token'

let refreshInProgress = null

function getCookieValue(name) {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const cookies = document.cookie.split(';')

  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim()
    if (cookie.startsWith(encodedName)) {
      return decodeURIComponent(cookie.substring(encodedName.length))
    }
  }

  return null
}

function getCsrfToken() {
  return getCookieValue(CSRF_COOKIE_NAME)
}

async function refreshAccessToken() {
  if (refreshInProgress) {
    return refreshInProgress
  }

  refreshInProgress = (async () => {
    try {
      const csrfToken = getCsrfToken()
      // Refresh token is sent automatically as an httpOnly cookie
      const response = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
      })
      return response
    } finally {
      refreshInProgress = null
    }
  })()

  return refreshInProgress
}

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

function unwrapResponseData(response) {
  return response?.data
}

function getDataRequest(url, config) {
  return apiClient.get(url, config).then(unwrapResponseData)
}

function getSettingsRequest(category = null) {
  if (category) {
    return apiClient.get(`/settings/category/${category}`)
  }
  return apiClient.get('/settings')
}

function updateSettingsRequest(categoryOrSettings, settings = null) {
  if (settings !== null && typeof categoryOrSettings === 'string') {
    return apiClient.put(`/settings/category/${categoryOrSettings}`, settings)
  }
  return apiClient.put('/settings', categoryOrSettings)
}

function retryQueueTaskRequest(taskId) {
  return apiClient.post(`/queue/task/${taskId}/retry`)
}

function cancelQueueTaskRequest(taskId) {
  return apiClient.post(`/queue/task/${taskId}/cancel`)
}

apiClient.interceptors.request.use(
  config => {
    const method = (config.method || 'get').toUpperCase()
    const needsCsrfHeader = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

    if (needsCsrfHeader) {
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        config.headers = {
          ...(config.headers || {}),
          'X-CSRF-Token': csrfToken
        }
      }
    }

    return config
  },
  error => Promise.reject(error)
)

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        await refreshAccessToken()
        return apiClient(originalRequest)
      } catch {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?expired=true'
        }

        return Promise.reject(error)
      }
    }

    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true'
      }
    }

    return Promise.reject(error)
  }
)

export {
  apiClient,
  getDataRequest,
  getSettingsRequest,
  retryQueueTaskRequest,
  cancelQueueTaskRequest,
  unwrapResponseData,
  updateSettingsRequest,
}
