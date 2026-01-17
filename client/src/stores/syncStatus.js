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

import { defineStore } from 'pinia'
import api from '@/api'

// Constants for sync types
export const SYNC_TYPE = {
  LIBRARY_SYNC: 'library_sync',
  FULL_RESYNC: 'full_resync',
  INCREMENTAL: 'incremental'
}

// Constants for polling intervals (in milliseconds)
const POLLING_INTERVAL = {
  ACTIVE: 2000,  // Fast polling when sync is active
  IDLE: 10000    // Slow polling when sync is idle
}

export const useSyncStatusStore = defineStore('syncStatus', {
  state: () => ({
    isRunning: false,
    type: null,
    progress: 0,
    currentLibrary: null,
    startedAt: null,
    pollInterval: null,
    // Track whether we're currently using fast (2s) vs slow (10s) polling interval
    isPollingActive: false
  }),

  actions: {
    async fetchStatus() {
      try {
        const response = await api.get('/sync/status')
        const wasRunning = this.isRunning
        this.isRunning = response.data.isRunning
        this.type = response.data.type
        this.progress = response.data.progress
        this.currentLibrary = response.data.currentLibrary
        this.startedAt = response.data.startedAt
        
        // If sync just started and we're in slow polling mode, switch to fast polling
        if (this.isRunning && !wasRunning && !this.isPollingActive) {
          this.switchToActivePoll()
        }
        // If sync just finished and we're in fast polling mode, switch to slow polling
        else if (!this.isRunning && wasRunning && this.isPollingActive) {
          this.switchToIdlePoll()
        }
      } catch (error) {
        console.error('Failed to fetch sync status', error)
      }
    },

    switchToActivePoll() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval)
      }
      this.isPollingActive = true
      this.pollInterval = setInterval(() => {
        this.fetchStatus()
      }, POLLING_INTERVAL.ACTIVE)
    },

    switchToIdlePoll() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval)
      }
      this.isPollingActive = false
      this.pollInterval = setInterval(() => {
        this.fetchStatus()
      }, POLLING_INTERVAL.IDLE)
    },

    async startPolling() {
      await this.fetchStatus()
      // Start with appropriate polling speed based on current sync state
      if (this.isRunning) {
        this.switchToActivePoll()
      } else {
        this.switchToIdlePoll()
      }
    },

    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval)
        this.pollInterval = null
        this.isPollingActive = false
      }
    }
  },

  getters: {
    // Determines if the "Sync Libraries" button should be enabled
    // Returns false during any active sync to prevent concurrent operations
    canStartSync: (state) => !state.isRunning,
    statusText: (state) => {
      if (!state.isRunning) return 'Idle'
      if (state.type === SYNC_TYPE.FULL_RESYNC) return 'Re-syncing...'
      if (state.type === SYNC_TYPE.LIBRARY_SYNC) return 'Syncing libraries...'
      return 'Syncing...'
    }
  }
})
