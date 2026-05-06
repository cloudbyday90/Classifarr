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
import { getCsrfToken } from '../utils/csrf.js'

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000

let refreshInProgress = null

async function refreshAccessToken() {
  if (refreshInProgress) {
    return refreshInProgress
  }

  refreshInProgress = (async () => {
    try {
      const csrfToken = getCsrfToken()
      return await axios.post('/api/auth/refresh', {}, {
        withCredentials: true,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
      })
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

apiClient.interceptors.request.use(
  config => {
    const method = (config.method || 'get').toUpperCase()
    const needsCsrfHeader = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

    if (needsCsrfHeader) {
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        config.headers = {
          ...(config.headers || {}),
          'X-CSRF-Token': csrfToken,
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

    // Retry on network errors and retryable HTTP status codes (5xx, 429).
    // Use exponential backoff: 1 s, 2 s, 4 s.
    const retryCount = originalRequest._retryCount ?? 0
    const isNetworkError = !error.response
    const isRetryableStatus = error.response && RETRYABLE_STATUS_CODES.has(error.response.status)

    if ((isNetworkError || isRetryableStatus) && retryCount < MAX_RETRIES) {
      originalRequest._retryCount = retryCount + 1
      const delay = BASE_RETRY_DELAY_MS * (2 ** retryCount)
      await new Promise(resolve => setTimeout(resolve, delay))
      return apiClient(originalRequest)
    }

    // Refresh the access token on a 401, then replay the original request once.
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

export { apiClient, refreshAccessToken }
