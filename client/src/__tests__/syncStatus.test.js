/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSyncStatusStore } from '../stores/syncStatus'
import api from '../api'

// Mock the API
vi.mock('../api', () => ({
  default: {
    get: vi.fn()
  }
}))

describe('useSyncStatusStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with default state', () => {
    const store = useSyncStatusStore()
    
    expect(store.isRunning).toBe(false)
    expect(store.type).toBe(null)
    expect(store.progress).toBe(0)
    expect(store.currentLibrary).toBe(null)
    expect(store.startedAt).toBe(null)
    expect(store.pollInterval).toBe(null)
  })

  it('fetches sync status successfully', async () => {
    const mockResponse = {
      data: {
        isRunning: true,
        type: 'library_sync',
        progress: 50,
        currentLibrary: 'Movies',
        startedAt: Date.now()
      }
    }
    
    api.get.mockResolvedValueOnce(mockResponse)
    
    const store = useSyncStatusStore()
    await store.fetchStatus()
    
    expect(api.get).toHaveBeenCalledWith('/sync/status')
    expect(store.isRunning).toBe(true)
    expect(store.type).toBe('library_sync')
    expect(store.progress).toBe(50)
    expect(store.currentLibrary).toBe('Movies')
  })

  it('handles fetch errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockRejectedValueOnce(new Error('Network error'))
    
    const store = useSyncStatusStore()
    await store.fetchStatus()
    
    expect(consoleError).toHaveBeenCalled()
    expect(store.isRunning).toBe(false)
    
    consoleError.mockRestore()
  })

  it('canStartSync getter returns true when not running', () => {
    const store = useSyncStatusStore()
    store.isRunning = false
    
    expect(store.canStartSync).toBe(true)
  })

  it('canStartSync getter returns false when library_sync is running', () => {
    const store = useSyncStatusStore()
    store.isRunning = true
    store.type = 'library_sync'
    
    expect(store.canStartSync).toBe(false)
  })

  it('canStartSync getter returns false when full_resync is running', () => {
    const store = useSyncStatusStore()
    store.isRunning = true
    store.type = 'full_resync'
    
    expect(store.canStartSync).toBe(false)
  })

  it('statusText returns correct text for idle state', () => {
    const store = useSyncStatusStore()
    store.isRunning = false
    
    expect(store.statusText).toBe('Idle')
  })

  it('statusText returns correct text for full_resync', () => {
    const store = useSyncStatusStore()
    store.isRunning = true
    store.type = 'full_resync'
    
    expect(store.statusText).toBe('Re-syncing...')
  })

  it('statusText returns correct text for library_sync', () => {
    const store = useSyncStatusStore()
    store.isRunning = true
    store.type = 'library_sync'
    
    expect(store.statusText).toBe('Syncing libraries...')
  })

  it('startPolling starts interval', async () => {
    vi.useFakeTimers()
    const store = useSyncStatusStore()
    
    api.get.mockResolvedValue({ data: { isRunning: false } })
    
    await store.startPolling()
    
    expect(store.pollInterval).not.toBe(null)
    
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('stopPolling clears interval', () => {
    vi.useFakeTimers()
    const store = useSyncStatusStore()
    
    api.get.mockResolvedValue({ data: { isRunning: false } })
    
    store.startPolling()
    const intervalId = store.pollInterval
    
    store.stopPolling()
    
    expect(store.pollInterval).toBe(null)
    
    vi.clearAllTimers()
    vi.useRealTimers()
  })
})
