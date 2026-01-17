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
    pollInterval: null
  }),

  actions: {
    async fetchStatus() {
      try {
        const response = await api.get('/sync/status')
        this.isRunning = response.data.isRunning
        this.type = response.data.type
        this.progress = response.data.progress
        this.currentLibrary = response.data.currentLibrary
        this.startedAt = response.data.startedAt
      } catch (error) {
        console.error('Failed to fetch sync status', error)
      }
    },

    startPolling() {
      this.fetchStatus()
      this.pollInterval = setInterval(() => {
        this.fetchStatus()
      }, 2000)
    },

    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval)
        this.pollInterval = null
      }
    }
  },

  getters: {
    canSync: (state) => !state.isRunning || state.type === 'full_resync',
    statusText: (state) => {
      if (!state.isRunning) return 'Idle'
      if (state.type === 'full_resync') return 'Re-syncing...'
      if (state.type === 'library_sync') return 'Syncing libraries...'
      return 'Syncing...'
    }
  }
})
