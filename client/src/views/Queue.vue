<!--
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 -->
<template>
  <div class="queue-view">
    <header class="page-header">
      <h1>Task Queue</h1>
      <p class="page-description">Monitor current processing tasks and their status</p>
    </header>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card pending">
        <div class="stat-icon">⏳</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.pending }}</span>
          <span class="stat-label">Pending</span>
        </div>
      </div>
      <div class="stat-card processing">
        <div class="stat-icon">⚙️</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.processing }}</span>
          <span class="stat-label">Processing</span>
        </div>
      </div>
      <div class="stat-card completed">
        <div class="stat-icon">✓</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.completed }}</span>
          <span class="stat-label">Completed</span>
        </div>
      </div>
      <div class="stat-card failed">
        <div class="stat-icon">✗</div>
        <div class="stat-content">
          <span class="stat-value">{{ stats.failed }}</span>
          <span class="stat-label">Failed</span>
        </div>
      </div>
    </div>

    <!-- Worker Status -->
    <div class="worker-status">
      <div class="status-indicator" :class="{ online: stats.workerRunning }">
        {{ stats.workerRunning ? 'Worker Active' : 'Worker Stopped' }}
      </div>
      <div class="status-indicator" :class="{ online: stats.aiAvailable }">
        {{ stats.aiAvailable ? 'AI Online' : 'AI Offline' }}
      </div>
    </div>

    <!-- Task Tabs -->
    <div class="task-tabs">
      <button 
        :class="{ active: activeTab === 'pending' }" 
        @click="activeTab = 'pending'"
      >
        Pending ({{ stats.pending }})
      </button>
      <button 
        :class="{ active: activeTab === 'failed' }" 
        @click="activeTab = 'failed'; loadFailedTasks()"
      >
        Failed ({{ stats.failed }})
      </button>
    </div>

    <!-- Tasks Table -->
    <div class="tasks-container">
      <div v-if="loading" class="loading">Loading tasks...</div>
      <div v-else-if="currentTasks.length === 0" class="empty-state">
        <p>No {{ activeTab }} tasks</p>
      </div>
      <table v-else class="tasks-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Title</th>
            <th>Status</th>
            <th>Attempt</th>
            <th v-if="activeTab === 'failed'">Error</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in currentTasks" :key="task.id">
            <td>{{ task.id }}</td>
            <td>
              <span class="task-type-badge">{{ task.task_type }}</span>
            </td>
            <td class="task-title">
              {{ getTaskTitle(task) }}
            </td>
            <td>
              <span class="status-badge" :class="task.status">
                {{ task.status }}
              </span>
            </td>
            <td>{{ task.attempts }}/{{ task.max_attempts }}</td>
            <td v-if="activeTab === 'failed'" class="error-cell">
              <span class="error-message" :title="task.error_message">
                {{ truncateError(task.error_message) }}
              </span>
            </td>
            <td>{{ formatTime(task.created_at) }}</td>
            <td class="actions">
              <button 
                v-if="task.status === 'failed'" 
                class="btn-retry"
                @click="retryTask(task.id)"
              >
                Retry
              </button>
              <button 
                v-if="task.status === 'pending'" 
                class="btn-cancel"
                @click="cancelTask(task.id)"
              >
                Cancel
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Auto-refresh indicator -->
    <div class="refresh-info">
      Auto-refreshes every 5 seconds
      <button @click="refreshData" class="btn-refresh">Refresh Now</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/api'

const stats = ref({
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  total: 0,
  workerRunning: false,
  aiAvailable: false
})

const pendingTasks = ref([])
const failedTasks = ref([])
const activeTab = ref('pending')
const loading = ref(true)
let refreshInterval = null

const currentTasks = computed(() => {
  return activeTab.value === 'pending' ? pendingTasks.value : failedTasks.value
})

async function loadStats() {
  try {
    const data = await api.getQueueStats()
    stats.value = data
  } catch (error) {
    console.error('Failed to load queue stats:', error)
  }
}

async function loadPendingTasks() {
  try {
    const data = await api.getQueuePending(50)
    pendingTasks.value = data
  } catch (error) {
    console.error('Failed to load pending tasks:', error)
  }
}

async function loadFailedTasks() {
  try {
    const data = await api.getQueueFailed(50)
    failedTasks.value = data
  } catch (error) {
    console.error('Failed to load failed tasks:', error)
  }
}

async function refreshData() {
  await loadStats()
  await loadPendingTasks()
  if (activeTab.value === 'failed') {
    await loadFailedTasks()
  }
}

async function retryTask(taskId) {
  try {
    await api.retryQueueTask(taskId)
    await refreshData()
  } catch (error) {
    console.error('Failed to retry task:', error)
  }
}

async function cancelTask(taskId) {
  try {
    await api.cancelQueueTask(taskId)
    await refreshData()
  } catch (error) {
    console.error('Failed to cancel task:', error)
  }
}

function getTaskTitle(task) {
  // Payload comes as the full payload object from the database
  const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload
  
  // Try various places where title might be stored
  if (task.title) return task.title  // Extracted by SQL
  if (payload?.title) return payload.title
  if (payload?.subject) return payload.subject
  if (payload?.media?.title) return payload.media.title
  if (payload?.itemId) return `Item #${payload.itemId}`
  if (payload?.media_id) return `Media ID: ${payload.media_id}`
  
  // Last resort - show task type and ID
  return `Task #${task.id}`
}

function truncateError(error) {
  if (!error) return 'No error message'
  return error.length > 60 ? error.substring(0, 60) + '...' : error
}

function formatTime(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString()
}

onMounted(async () => {
  await refreshData()
  loading.value = false
  refreshInterval = setInterval(refreshData, 5000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.queue-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.page-description {
  color: var(--text-secondary);
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.stat-card.pending { border-left: 4px solid #f59e0b; }
.stat-card.processing { border-left: 4px solid #3b82f6; }
.stat-card.completed { border-left: 4px solid #10b981; }
.stat-card.failed { border-left: 4px solid #ef4444; }

.stat-icon {
  font-size: 1.5rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.worker-status {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-indicator::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status-indicator.online {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-indicator.online::before {
  background: #10b981;
}

.task-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.task-tabs button {
  padding: 0.75rem 1.5rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s;
}

.task-tabs button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.task-tabs button.active {
  background: var(--accent-color);
  color: white;
}

.tasks-container {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.loading, .empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
}

.tasks-table {
  width: 100%;
  border-collapse: collapse;
}

.tasks-table th,
.tasks-table td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.tasks-table th {
  background: var(--bg-tertiary);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.tasks-table tbody tr:hover {
  background: var(--bg-hover);
}

.task-title {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-tertiary);
  font-size: 0.75rem;
  text-transform: uppercase;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.status-badge.processing { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.status-badge.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.status-badge.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.error-cell {
  max-width: 200px;
}

.error-message {
  color: #ef4444;
  font-size: 0.8rem;
  cursor: help;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-retry, .btn-cancel {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-retry {
  background: var(--accent-color);
  color: white;
}

.btn-cancel {
  background: #ef4444;
  color: white;
}

.btn-retry:hover, .btn-cancel:hover {
  opacity: 0.8;
}

.refresh-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.btn-refresh {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
}

.btn-refresh:hover {
  background: var(--bg-tertiary);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
