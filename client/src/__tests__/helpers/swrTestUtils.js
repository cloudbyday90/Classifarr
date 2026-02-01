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

import { vi } from 'vitest'

const STORAGE_PREFIX = 'classifarr:v1:swr:'
let originalLocalStorageDescriptor
let hasStoredLocalStorageDescriptor = false

/**
 * Create a mock localStorage for tests
 * @returns {Object} Mock localStorage with spy functions
 */
export function createMockLocalStorage() {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get _store() { return store },
    set _store(newStore) { store = newStore }
  }
}

/**
 * Pre-populate SWR cache for testing
 * @param {string} key - Cache key (without prefix)
 * @param {*} value - Value to cache
 * @param {number} timestamp - Cache timestamp (default: now)
 */
export function setSWRCache(key, value, timestamp = Date.now()) {
  const fullKey = `${STORAGE_PREFIX}${key}`
  const data = JSON.stringify({ value, timestamp })
  // Directly set in mock store AND call the mock function for spying
  if (localStorage._store) {
    localStorage._store[fullKey] = data
  }
  localStorage.setItem(fullKey, data)
}

/**
 * Get SWR cache entry for testing
 * @param {string} key - Cache key (without prefix)
 * @returns {Object|null} Cached entry { value, timestamp } or null
 */
export function getSWRCache(key) {
  const fullKey = `${STORAGE_PREFIX}${key}`
  const cached = localStorage.getItem(fullKey)
  if (!cached) return null
  try {
    return JSON.parse(cached)
  } catch {
    return null
  }
}

/**
 * Clear all SWR cache entries
 */
export function clearSWRCache() {
  const store = localStorage._store || {}
  Object.keys(store)
    .filter(k => k.startsWith(STORAGE_PREFIX))
    .forEach(k => localStorage.removeItem(k))
}

/**
 * Create an expired cache entry (for TTL testing)
 * @param {string} key - Cache key (without prefix)
 * @param {*} value - Value to cache
 * @param {number} ageMs - Age of cache in ms (default: 120000 = 2 minutes)
 */
export function setSWRCacheExpired(key, value, ageMs = 120000) {
  setSWRCache(key, value, Date.now() - ageMs)
}

/**
 * Create a mock fetcher function
 * @param {*} resolveValue - Value to resolve with
 * @param {number} delay - Optional delay in ms
 * @returns {Function} Mock fetcher
 */
export function createMockFetcher(resolveValue, delay = 0) {
  const fetcher = vi.fn().mockImplementation(() => {
    if (delay > 0) {
      return new Promise(resolve => setTimeout(() => resolve(resolveValue), delay))
    }
    return Promise.resolve(resolveValue)
  })
  return fetcher
}

/**
 * Create a failing mock fetcher
 * @param {string} errorMessage - Error message
 * @param {number} statusCode - Optional HTTP status code
 * @returns {Function} Mock fetcher that rejects
 */
export function createFailingFetcher(errorMessage = 'Fetch failed', statusCode = null) {
  const error = new Error(errorMessage)
  if (statusCode) {
    error.response = { status: statusCode }
  }
  return vi.fn().mockRejectedValue(error)
}

/**
 * Setup localStorage mock for test suite
 * Call in beforeEach
 * @returns {Object} The mock localStorage
 */
export function setupLocalStorageMock() {
  const mockStorage = createMockLocalStorage()
  if (!hasStoredLocalStorageDescriptor) {
    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    hasStoredLocalStorageDescriptor = true
  }
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true
    })
  } catch {
    vi.stubGlobal('localStorage', mockStorage)
  }
  return mockStorage
}

/**
 * Cleanup localStorage mock
 * Call in afterEach
 */
export function cleanupLocalStorageMock() {
  if (!hasStoredLocalStorageDescriptor) return
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor)
  } else {
    try {
      delete globalThis.localStorage
    } catch {
      /* ignore cleanup errors */
    }
  }
}
