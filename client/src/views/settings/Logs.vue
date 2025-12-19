<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Error Logs</h2>
      <p class="text-gray-400 text-sm">View and manage application error logs</p>
    </div>

    <!-- Statistics Dashboard -->
    <div v-if="stats" class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-gray-400 text-sm">Total Errors</div>
        <div class="text-2xl font-bold text-red-400">{{ stats.totals.total_errors }}</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-gray-400 text-sm">Unresolved</div>
        <div class="text-2xl font-bold text-orange-400">{{ stats.totals.unresolved_errors }}</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-gray-400 text-sm">Last 24h</div>
        <div class="text-2xl font-bold text-yellow-400">{{ stats.trends.last24h.errors_24h }}</div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div class="text-gray-400 text-sm">Last 7d</div>
        <div class="text-2xl font-bold text-blue-400">{{ stats.trends.last7d.errors_7d }}</div>
      </div>
    </div>

    <!-- Filters and Actions -->
    <div class="flex flex-wrap gap-4 items-center">
      <div class="flex-1 min-w-[200px]">
        <select
          v-model="filters.level"
          @change="loadLogs"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
        >
          <option value="">All Levels</option>
          <option value="ERROR">Error</option>
          <option value="WARN">Warning</option>
        </select>
      </div>
      <div class="flex-1 min-w-[200px]">
        <input
          v-model="filters.module"
          @input="debouncedLoadLogs"
          placeholder="Filter by module..."
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
        />
      </div>
      <div class="flex-1 min-w-[200px]">
        <select
          v-model="filters.resolved"
          @change="loadLogs"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg"
        >
          <option value="">All Status</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
      </div>
      <button
        @click="exportLogs"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        Export JSON
      </button>
      <button
        @click="cleanupLogs"
        class="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
      >
        Cleanup Old Logs
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <div class="text-gray-400">Loading logs...</div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
      {{ error }}
    </div>

    <!-- Logs Table -->
    <div v-if="!loading && logs.length > 0" class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-700">
          <tr>
            <th class="px-4 py-3 text-left text-sm font-medium">Level</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Module</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Message</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Time</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th class="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700">
          <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-700/50">
            <td class="px-4 py-3">
              <span
                :class="[
                  'px-2 py-1 rounded text-xs font-medium',
                  log.level === 'ERROR' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'
                ]"
              >
                {{ log.level }}
              </span>
            </td>
            <td class="px-4 py-3 text-sm">{{ log.module }}</td>
            <td class="px-4 py-3 text-sm truncate max-w-xs">{{ log.message }}</td>
            <td class="px-4 py-3 text-sm text-gray-400">{{ formatDate(log.created_at) }}</td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'px-2 py-1 rounded text-xs',
                  log.resolved ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'
                ]"
              >
                {{ log.resolved ? 'Resolved' : 'Open' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <button
                @click="viewDetails(log.error_id)"
                class="text-blue-400 hover:text-blue-300 text-sm"
              >
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Logs -->
    <div v-if="!loading && logs.length === 0" class="text-center py-8 text-gray-400">
      No logs found
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="flex justify-center gap-2">
      <button
        @click="changePage(pagination.page - 1)"
        :disabled="pagination.page <= 1"
        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg"
      >
        Previous
      </button>
      <span class="px-4 py-2 bg-gray-800 rounded-lg">
        Page {{ pagination.page }} of {{ pagination.totalPages }}
      </span>
      <button
        @click="changePage(pagination.page + 1)"
        :disabled="pagination.page >= pagination.totalPages"
        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg"
      >
        Next
      </button>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="closeModal"
    >
      <div class="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="p-6 space-y-4">
          <div class="flex justify-between items-start">
            <h3 class="text-xl font-bold">Error Details</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-white">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="selectedLog" class="space-y-4">
            <!-- Basic Info -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-sm text-gray-400">Error ID</div>
                <div class="font-mono text-sm">{{ selectedLog.error_id }}</div>
              </div>
              <div>
                <div class="text-sm text-gray-400">Timestamp</div>
                <div class="text-sm">{{ formatDate(selectedLog.created_at) }}</div>
              </div>
              <div>
                <div class="text-sm text-gray-400">Level</div>
                <div>
                  <span
                    :class="[
                      'px-2 py-1 rounded text-xs',
                      selectedLog.level === 'ERROR' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'
                    ]"
                  >
                    {{ selectedLog.level }}
                  </span>
                </div>
              </div>
              <div>
                <div class="text-sm text-gray-400">Module</div>
                <div>{{ selectedLog.module }}</div>
              </div>
            </div>

            <!-- Message -->
            <div>
              <div class="text-sm text-gray-400 mb-2">Message</div>
              <div class="bg-gray-900 p-3 rounded">{{ selectedLog.message }}</div>
            </div>

            <!-- Stack Trace -->
            <div v-if="selectedLog.stack_trace">
              <div class="text-sm text-gray-400 mb-2">Stack Trace</div>
              <pre class="bg-gray-900 p-3 rounded text-xs overflow-x-auto">{{ selectedLog.stack_trace }}</pre>
            </div>

            <!-- Request Context -->
            <div v-if="selectedLog.request_context">
              <div class="text-sm text-gray-400 mb-2">Request Context</div>
              <pre class="bg-gray-900 p-3 rounded text-xs overflow-x-auto">{{ JSON.stringify(selectedLog.request_context, null, 2) }}</pre>
            </div>

            <!-- System Context -->
            <div v-if="selectedLog.system_context">
              <div class="text-sm text-gray-400 mb-2">System Context</div>
              <pre class="bg-gray-900 p-3 rounded text-xs overflow-x-auto">{{ JSON.stringify(selectedLog.system_context, null, 2) }}</pre>
            </div>

            <!-- Metadata -->
            <div v-if="selectedLog.metadata">
              <div class="text-sm text-gray-400 mb-2">Additional Data</div>
              <pre class="bg-gray-900 p-3 rounded text-xs overflow-x-auto">{{ JSON.stringify(selectedLog.metadata, null, 2) }}</pre>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-4 border-t border-gray-700">
              <button
                @click="copyBugReport"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Copy Bug Report
              </button>
              <button
                v-if="!selectedLog.resolved"
                @click="resolveError"
                class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Mark as Resolved
              </button>
            </div>

            <!-- Success Message -->
            <div v-if="copySuccess" class="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
              Bug report copied to clipboard!
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const logs = ref([])
const stats = ref(null)
const loading = ref(false)
const error = ref(null)
const showModal = ref(false)
const selectedLog = ref(null)
const copySuccess = ref(false)

const filters = ref({
  level: '',
  module: '',
  resolved: ''
})

const pagination = ref({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0
})

onMounted(() => {
  loadStats()
  loadLogs()
})

async function loadStats() {
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get('/api/logs/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
    stats.value = response.data
  } catch (err) {
    console.error('Failed to load stats:', err)
  }
}

async function loadLogs() {
  loading.value = true
  error.value = null
  
  try {
    const token = localStorage.getItem('token')
    const params = new URLSearchParams({
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    
    if (filters.value.level) params.append('level', filters.value.level)
    if (filters.value.module) params.append('module', filters.value.module)
    if (filters.value.resolved) params.append('resolved', filters.value.resolved)
    
    const response = await axios.get(`/api/logs?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    logs.value = response.data.logs
    pagination.value = response.data.pagination
  } catch (err) {
    error.value = 'Failed to load logs: ' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
  }
}

let debounceTimer = null
function debouncedLoadLogs() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pagination.value.page = 1
    loadLogs()
  }, 500)
}

function changePage(page) {
  pagination.value.page = page
  loadLogs()
}

async function viewDetails(errorId) {
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get(`/api/logs/error/${errorId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    selectedLog.value = response.data
    showModal.value = true
    copySuccess.value = false
  } catch (err) {
    error.value = 'Failed to load error details: ' + (err.response?.data?.error || err.message)
  }
}

function closeModal() {
  showModal.value = false
  selectedLog.value = null
  copySuccess.value = false
}

async function copyBugReport() {
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get(`/api/logs/error/${selectedLog.value.error_id}/report`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    await navigator.clipboard.writeText(response.data.report)
    copySuccess.value = true
    
    setTimeout(() => {
      copySuccess.value = false
    }, 3000)
  } catch (err) {
    error.value = 'Failed to copy bug report: ' + (err.response?.data?.error || err.message)
  }
}

async function resolveError() {
  try {
    const token = localStorage.getItem('token')
    await axios.post(
      `/api/logs/error/${selectedLog.value.error_id}/resolve`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )
    
    closeModal()
    loadLogs()
    loadStats()
  } catch (err) {
    error.value = 'Failed to resolve error: ' + (err.response?.data?.error || err.message)
  }
}

async function exportLogs() {
  try {
    const token = localStorage.getItem('token')
    const params = new URLSearchParams()
    
    if (filters.value.level) params.append('level', filters.value.level)
    if (filters.value.module) params.append('module', filters.value.module)
    
    const response = await axios.get(`/api/logs/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-export-${Date.now()}.json`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    error.value = 'Failed to export logs: ' + (err.response?.data?.error || err.message)
  }
}

async function cleanupLogs() {
  if (!confirm('This will delete old logs based on retention settings. Continue?')) {
    return
  }
  
  try {
    const token = localStorage.getItem('token')
    const response = await axios.post('/api/logs/cleanup', {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    alert(`Cleanup completed. Deleted ${response.data.deleted.errorLogs} error logs and ${response.data.deleted.appLogs} app logs.`)
    loadLogs()
    loadStats()
  } catch (err) {
    error.value = 'Failed to cleanup logs: ' + (err.response?.data?.error || err.message)
  }
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString()
}
</script>
