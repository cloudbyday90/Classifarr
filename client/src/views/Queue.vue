<!--
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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
      <div class="stat-card awaiting" v-if="pendingClassifications.length > 0">
        <div class="stat-icon">❓</div>
        <div class="stat-content">
          <span class="stat-value">{{ pendingClassifications.length }}</span>
          <span class="stat-label">Awaiting Decision</span>
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
      <button 
        :class="{ active: activeTab === 'awaiting' }" 
        @click="activeTab = 'awaiting'"
        class="awaiting-tab"
      >
        ❓ Awaiting Decision ({{ pendingClassifications.length }})
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
              <!-- Manual Classification: Skip AI -->
              <button 
                v-if="task.status === 'pending'" 
                class="btn-classify"
                @click="showManualClassify(task)"
                :disabled="classifyingTaskId === task.id"
                title="Bypass AI and classify immediately. Item will NOT be queued for AI analysis - you select the library directly."
              >
                {{ classifyingTaskId === task.id ? 'Classifying...' : '🏷️ Classify' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pending Classifications (Awaiting Decision) -->
    <div v-if="activeTab === 'awaiting'" class="pending-classifications">
      <div v-if="pendingClassifications.length === 0" class="empty-state">
        <p>No items awaiting decision</p>
      </div>
      <div v-else class="pending-grid">
        <div v-for="item in pendingClassifications" :key="item.id" class="pending-card">
          <div class="pending-header">
            <span class="media-type-badge">{{ item.media_type }}</span>
            <span class="confidence-badge">{{ item.confidence }}% confident</span>
          </div>
          <h3 class="pending-title">{{ item.title }} ({{ item.year || 'N/A' }})</h3>
          <p class="pending-reason" v-if="getPrimaryNeedsAttentionReason(item)">{{ getPrimaryNeedsAttentionReason(item) }}</p>
          <p v-if="getTargetedRecheckLine(item)" class="recheck-diagnostic">
            {{ getTargetedRecheckLine(item) }}
          </p>
          
          <!-- Policy Question -->
          <div v-if="item.policy_question" class="policy-question">
            <p class="question-text">{{ item.policy_question.question }}</p>
            <p class="uncertainty-reason">{{ item.policy_question.why_uncertain }}</p>
            <div class="options-grid">
              <button 
                v-for="option in item.policy_question.options" 
                :key="option.value"
                class="option-btn"
                :class="{ 'has-library': option.library_id }"
                @click="resolveClassification(item.id, option)"
                :disabled="resolvingId === item.id"
              >
                {{ option.label }}
                <span v-if="option.library_name" class="library-hint">→ {{ option.library_name }}</span>
              </button>
            </div>
          </div>
          
          <!-- Manual Selection if no policy question -->
          <div v-else class="manual-selection">
            <p>Select a library:</p>
            <select v-model="selectedLibraries[item.id]" class="library-select">
              <option :value="undefined">Choose library...</option>
              <option v-for="lib in libraries" :key="lib.id" :value="lib.id">
                {{ lib.name }}
              </option>
            </select>
            <button 
              class="btn-resolve" 
              @click="resolveManual(item.id)"
              :disabled="!selectedLibraries[item.id] || resolvingId === item.id"
            >
              {{ resolvingId === item.id ? 'Resolving...' : 'Resolve' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Auto-refresh indicator -->
    <div class="refresh-info">
      Auto-refreshes every 5 seconds
      <button @click="refreshData" class="btn-refresh">Refresh Now</button>
    </div>

    <!-- Manual Classification Modal -->
    <div v-if="manualClassifyTask" class="modal-overlay" @click.self="closeManualClassify">
      <div class="modal">
        <div class="modal-header">
          <h3>🏷️ Classify Manually</h3>
          <button class="modal-close" @click="closeManualClassify">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-title">{{ getTaskTitle(manualClassifyTask) }}</p>
          <p class="modal-subtitle">Skip AI and assign directly to a library</p>
          
          <div class="modal-form">
            <label>Select Library:</label>
            <select v-model="selectedClassifyLibrary" class="library-select">
              <option :value="null">Choose library...</option>
              <option v-for="lib in filteredLibraries" :key="lib.id" :value="lib.id">
                {{ lib.name }} ({{ lib.media_type }})
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeManualClassify">Cancel</button>
          <button 
            class="btn-resolve" 
            @click="submitManualClassify" 
            :disabled="!selectedClassifyLibrary || classifyingTaskId"
          >
            {{ classifyingTaskId ? 'Classifying...' : 'Classify & Route' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '@/api'
import { primaryNeedsAttentionReason, targetedRecheckLine } from '@/utils/needsAttention'

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
const pendingClassifications = ref([])
const libraries = ref([])
const selectedLibraries = ref({})
const resolvingId = ref(null)
const activeTab = ref('pending')
const loading = ref(true)
// Manual classification from worker queue
const classifyingTaskId = ref(null)
const manualClassifyTask = ref(null)
const selectedClassifyLibrary = ref(null)
let refreshInterval = null

const currentTasks = computed(() => {
  return activeTab.value === 'pending' ? pendingTasks.value : failedTasks.value
})

// Filter libraries by task's media type (movie/tv)
const filteredLibraries = computed(() => {
  if (!manualClassifyTask.value) return libraries.value
  
  // Extract media_type from task payload - check multiple possible locations
  // Overseerr/Jellyseerr use different structures
  const task = manualClassifyTask.value
  const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload
  
  // Check all possible paths where media_type might be stored
  const mediaType = 
    payload?.media?.media_type ||      // Standard media object
    payload?.media_type ||              // Direct property
    payload?.mediaType ||               // Overseerr/Jellyseerr camelCase
    payload?.subject?.mediaType ||      // Overseerr notification format
    payload?.request?.media?.mediaType || // Overseerr request format
    payload?.type ||                    // Simple type property
    null
  
  // Normalize: Overseerr uses 'tv' or 'movie', but might also use 'series'
  const normalizedType = mediaType === 'series' ? 'tv' : mediaType
  
  if (!normalizedType) return libraries.value // Show all if can't determine
  
  // Filter: 'movie' matches 'movie', 'tv' matches 'tv'
  return libraries.value.filter(lib => lib.media_type === normalizedType)
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
  await loadPendingClassifications()
  if (activeTab.value === 'failed') {
    await loadFailedTasks()
  }
}

async function loadPendingClassifications() {
  try {
    const data = await api.getPendingClassifications()
    pendingClassifications.value = data.items || []
  } catch (error) {
    console.error('Failed to load pending classifications:', error)
  }
}

async function loadLibraries() {
  try {
    const libData = await api.getLibraries()
    libraries.value = Array.isArray(libData) ? libData.filter(lib => lib.is_active) : []
  } catch (error) {
    console.error('Failed to load libraries:', error)
  }
}

async function resolveClassification(classificationId, option) {
  if (!option.library_id) {
    alert('This option has no linked library. Please select manually.')
    return
  }
  resolvingId.value = classificationId
  try {
    await api.resolvePendingClassification(classificationId, {
      library_id: option.library_id,
      selected_option: option.label,
      resolved_by: 'admin',
      generate_rule: true
    })
    await loadPendingClassifications()
  } catch (error) {
    console.error('Failed to resolve classification:', error)
    alert('Failed to resolve: ' + error.message)
  } finally {
    resolvingId.value = null
  }
}

async function resolveManual(classificationId) {
  const libraryId = selectedLibraries.value[classificationId]
  if (!libraryId) return
  
  resolvingId.value = classificationId
  try {
    await api.resolvePendingClassification(classificationId, {
      library_id: libraryId,
      selected_option: 'Manual selection',
      resolved_by: 'admin',
      generate_rule: true
    })
    await loadPendingClassifications()
    delete selectedLibraries.value[classificationId]
  } catch (error) {
    console.error('Failed to resolve classification:', error)
    alert('Failed to resolve: ' + error.message)
  } finally {
    resolvingId.value = null
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

// Manual classification from worker queue - bypasses AI
async function showManualClassify(task) {
  manualClassifyTask.value = task
  selectedClassifyLibrary.value = null
  // Load libraries if not already loaded
  if (libraries.value.length === 0) {
    await loadLibraries()
  }
}

function closeManualClassify() {
  manualClassifyTask.value = null
  selectedClassifyLibrary.value = null
  classifyingTaskId.value = null
}

async function submitManualClassify() {
  if (!manualClassifyTask.value || !selectedClassifyLibrary.value) return
  
  const task = manualClassifyTask.value
  const libraryId = selectedClassifyLibrary.value
  
  classifyingTaskId.value = task.id
  try {
    // Call backend to manually classify this task
    await api.classifyQueueTask(task.id, {
      library_id: libraryId,
      resolved_by: 'admin'
    })
    closeManualClassify()
    await refreshData()
  } catch (error) {
    console.error('Failed to manually classify:', error)
    alert('Failed to classify: ' + error.message)
  } finally {
    classifyingTaskId.value = null
  }
}

function getTargetedRecheckLine(item) {
  return targetedRecheckLine(item)
}

function getPrimaryNeedsAttentionReason(item) {
  return primaryNeedsAttentionReason(item)
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
  await loadLibraries()
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

/* Pending Classifications Styles */
.stat-card.awaiting { border-left: 4px solid #8b5cf6; }

.awaiting-tab {
  background: rgba(139, 92, 246, 0.1) !important;
  color: #8b5cf6 !important;
}

.awaiting-tab.active {
  background: #8b5cf6 !important;
  color: white !important;
}

.pending-classifications {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 1.5rem;
}

.pending-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;
}

.pending-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-left: 4px solid #8b5cf6;
  border-radius: 8px;
  padding: 1.25rem;
}

.pending-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.media-type-badge {
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.confidence-badge {
  padding: 0.25rem 0.5rem;
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
  border-radius: 4px;
  font-size: 0.75rem;
}

.pending-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.pending-reason {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0 0 1rem 0;
}

.recheck-diagnostic {
  color: #67e8f9;
  font-size: 0.8125rem;
  margin: 0 0 1rem 0;
  line-height: 1.35;
}

.policy-question {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
}

.question-text {
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.uncertainty-reason {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 1rem 0;
  font-style: italic;
}

.options-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 120px;
}

.option-btn:hover {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.05);
}

.option-btn.has-library {
  border-color: #10b981;
}

.option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.library-hint {
  font-size: 0.7rem;
  color: #10b981;
  margin-top: 0.25rem;
}

.manual-selection {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.library-select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  min-width: 180px;
}

/* Fix dropdown options visibility */
.library-select option {
  background: #1f2937;
  color: #f3f4f6;
  padding: 0.5rem;
}

.btn-resolve {
  padding: 0.5rem 1rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-resolve:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Classify button in pending queue */
.btn-classify {
  background: #8b5cf6;
  color: white;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-classify:hover {
  background: #7c3aed;
}

.btn-classify:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #1f2937;
  border: 2px solid #374151;
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1.25rem;
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.modal-subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin: 0 0 1rem 0;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal-form label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
</style>
