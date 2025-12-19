<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold mb-2">Error Logs</h2>
      <p class="text-gray-400 text-sm">View and manage application error logs</p>
    </div>

    <!-- Statistics Dashboard -->
    <div v-if="stats" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="text-gray-400 text-sm">Total Errors</div>
        <div class="text-2xl font-bold">{{ stats.summary?.total_errors || 0 }}</div>
        <div class="text-xs text-gray-500 mt-1">
          {{ stats.summary?.last_24h || 0 }} in last 24h
        </div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="text-gray-400 text-sm">Resolved</div>
        <div class="text-2xl font-bold text-green-400">{{ stats.summary?.resolved_count || 0 }}</div>
        <div class="text-xs text-gray-500 mt-1">
          {{ stats.summary?.last_7d || 0 }} in last 7 days
        </div>
      </div>
      <div class="bg-gray-800 p-4 rounded-lg">
        <div class="text-gray-400 text-sm">Top Module</div>
        <div class="text-lg font-bold truncate">{{ stats.byModule?.[0]?.module || 'N/A' }}</div>
        <div class="text-xs text-gray-500 mt-1">
          {{ stats.byModule?.[0]?.count || 0 }} errors
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-gray-800 p-4 rounded-lg space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Level</label>
          <select
            v-model="filters.level"
            @change="fetchLogs"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Levels</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Module</label>
          <input
            v-model="filters.module"
            @input="debouncedFetch"
            type="text"
            placeholder="Filter by module..."
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Per Page</label>
          <select
            v-model="filters.limit"
            @change="fetchLogs"
            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
        <div class="flex items-end">
          <button
            @click="exportLogs"
            class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Export Logs
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <div class="text-gray-400">Loading logs...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-900/30 text-red-400 p-4 rounded-lg">
      {{ error }}
    </div>

    <!-- Logs Table -->
    <div v-else class="bg-gray-800 rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-700">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium">Time</th>
              <th class="px-4 py-3 text-left text-sm font-medium">Level</th>
              <th class="px-4 py-3 text-left text-sm font-medium">Module</th>
              <th class="px-4 py-3 text-left text-sm font-medium">Message</th>
              <th class="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th class="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-750">
              <td class="px-4 py-3 text-sm text-gray-400">
                {{ formatDate(log.created_at) }}
              </td>
              <td class="px-4 py-3">
                <span :class="getLevelClass(log.level)" class="px-2 py-1 text-xs font-medium rounded">
                  {{ log.level }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm">
                <code class="text-blue-400">{{ log.module }}</code>
              </td>
              <td class="px-4 py-3 text-sm">
                <div class="max-w-md truncate" :title="log.message">
                  {{ log.message }}
                </div>
              </td>
              <td class="px-4 py-3 text-sm">
                <span v-if="log.resolved" class="text-green-400">✓ Resolved</span>
                <span v-else class="text-yellow-400">○ Open</span>
              </td>
              <td class="px-4 py-3 text-right space-x-2">
                <button
                  @click="viewDetails(log)"
                  class="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="bg-gray-700 px-4 py-3 flex items-center justify-between">
        <div class="text-sm text-gray-400">
          Showing {{ (currentPage - 1) * filters.limit + 1 }} to 
          {{ Math.min(currentPage * filters.limit, total) }} of {{ total }} errors
        </div>
        <div class="flex space-x-2">
          <button
            @click="prevPage"
            :disabled="currentPage === 1"
            class="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded transition-colors"
          >
            Previous
          </button>
          <button
            @click="nextPage"
            :disabled="currentPage * filters.limit >= total"
            class="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Error Detail Modal -->
    <div
      v-if="selectedLog"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="selectedLog = null"
    >
      <div class="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
          <h3 class="text-xl font-bold">Error Details</h3>
          <button @click="selectedLog = null" class="text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="p-6 space-y-4">
          <!-- Error ID -->
          <div>
            <div class="text-sm text-gray-400 mb-1">Error ID</div>
            <code class="text-blue-400">{{ selectedLog.error_id }}</code>
          </div>

          <!-- Basic Info -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm text-gray-400 mb-1">Level</div>
              <span :class="getLevelClass(selectedLog.level)" class="px-2 py-1 text-xs font-medium rounded">
                {{ selectedLog.level }}
              </span>
            </div>
            <div>
              <div class="text-sm text-gray-400 mb-1">Module</div>
              <code class="text-blue-400">{{ selectedLog.module }}</code>
            </div>
          </div>

          <!-- Message -->
          <div>
            <div class="text-sm text-gray-400 mb-1">Message</div>
            <div class="bg-gray-900 p-3 rounded font-mono text-sm whitespace-pre-wrap">{{ selectedLog.message }}</div>
          </div>

          <!-- Stack Trace -->
          <div v-if="selectedLog.stack_trace">
            <div class="text-sm text-gray-400 mb-1">Stack Trace</div>
            <div class="bg-gray-900 p-3 rounded font-mono text-xs overflow-x-auto whitespace-pre-wrap">{{ selectedLog.stack_trace }}</div>
          </div>

          <!-- Request Context -->
          <div v-if="selectedLog.request_context">
            <div class="text-sm text-gray-400 mb-1">Request Context</div>
            <div class="bg-gray-900 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{{ JSON.stringify(selectedLog.request_context, null, 2) }}</pre>
            </div>
          </div>

          <!-- System Context -->
          <div v-if="selectedLog.system_context">
            <div class="text-sm text-gray-400 mb-1">System Context</div>
            <div class="bg-gray-900 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{{ JSON.stringify(selectedLog.system_context, null, 2) }}</pre>
            </div>
          </div>

          <!-- Metadata -->
          <div v-if="selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0">
            <div class="text-sm text-gray-400 mb-1">Metadata</div>
            <div class="bg-gray-900 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{{ JSON.stringify(selectedLog.metadata, null, 2) }}</pre>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex space-x-3 pt-4">
            <button
              @click="generateBugReport"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              📋 Copy Bug Report
            </button>
            <button
              v-if="!selectedLog.resolved"
              @click="resolveError"
              class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              ✓ Mark as Resolved
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="actionMessage" class="bg-green-900/30 text-green-400 p-3 rounded-lg">
            {{ actionMessage }}
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
const loading = ref(true)
const error = ref(null)
const selectedLog = ref(null)
const actionMessage = ref('')
const total = ref(0)
const currentPage = ref(1)

const filters = ref({
  level: '',
  module: '',
  limit: 50,
})

let debounceTimer = null

const debouncedFetch = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    fetchLogs()
  }, 500)
}

const fetchLogs = async () => {
  try {
    loading.value = true
    error.value = null

    const params = {
      level: filters.value.level || undefined,
      module: filters.value.module || undefined,
      limit: filters.value.limit,
      offset: (currentPage.value - 1) * filters.value.limit,
    }

    const response = await axios.get('/api/logs', { params })
    logs.value = response.data.logs
    total.value = response.data.total
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const response = await axios.get('/api/logs/stats')
    stats.value = response.data
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  }
}

const viewDetails = (log) => {
  selectedLog.value = log
  actionMessage.value = ''
}

const generateBugReport = async () => {
  try {
    const response = await axios.get(`/api/logs/error/${selectedLog.value.error_id}/report`)
    await navigator.clipboard.writeText(response.data)
    actionMessage.value = '✓ Bug report copied to clipboard!'
    setTimeout(() => {
      actionMessage.value = ''
    }, 3000)
  } catch (err) {
    actionMessage.value = '✗ Failed to copy: ' + err.message
  }
}

const resolveError = async () => {
  try {
    await axios.post(`/api/logs/error/${selectedLog.value.error_id}/resolve`, {
      notes: 'Resolved from UI'
    })
    selectedLog.value.resolved = true
    actionMessage.value = '✓ Error marked as resolved'
    fetchLogs()
    fetchStats()
  } catch (err) {
    actionMessage.value = '✗ Failed to resolve: ' + err.message
  }
}

const exportLogs = async () => {
  try {
    const params = {
      level: filters.value.level || undefined,
      limit: 1000,
    }
    
    const response = await axios.get('/api/logs/export', {
      params,
      responseType: 'blob'
    })

    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `classifarr-logs-${Date.now()}.json`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (err) {
    error.value = 'Failed to export logs: ' + err.message
  }
}

const nextPage = () => {
  if (currentPage.value * filters.value.limit < total.value) {
    currentPage.value++
    fetchLogs()
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    fetchLogs()
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const getLevelClass = (level) => {
  const classes = {
    ERROR: 'bg-red-900/30 text-red-400',
    WARN: 'bg-yellow-900/30 text-yellow-400',
    INFO: 'bg-blue-900/30 text-blue-400',
    DEBUG: 'bg-gray-700 text-gray-400',
  }
  return classes[level] || 'bg-gray-700 text-gray-400'
}

onMounted(() => {
  fetchLogs()
  fetchStats()
})
</script>
