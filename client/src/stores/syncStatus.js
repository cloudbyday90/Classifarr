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

export const useSyncStatusStore = defineStore('syncStatus', {
  state: () => ({
    isRunning: false,
    type: null,
    progress: 0,
    currentLibrary: null,
    startedAt: null,
    pollInterval: null,
    isPollingActive: false // Track if we're already in active polling mode
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
      }, 2000) // Fast polling when active
    },

    switchToIdlePoll() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval)
      }
      this.isPollingActive = false
      this.pollInterval = setInterval(() => {
        this.fetchStatus()
      }, 10000) // Slow polling when idle
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
    // Button is disabled during ANY active sync operation
    // This prevents conflicts between concurrent sync operations
    canSync: (state) => !state.isRunning,
    statusText: (state) => {
      if (!state.isRunning) return 'Idle'
      if (state.type === 'full_resync') return 'Re-syncing...'
      if (state.type === 'library_sync') return 'Syncing libraries...'
      return 'Syncing...'
    }
  }
})
