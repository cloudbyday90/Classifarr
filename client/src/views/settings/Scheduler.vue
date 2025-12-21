<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Scheduled Tasks</h2>
        <p class="text-gray-400 text-sm">Automate library scans and classifications</p>
      </div>
      <button
        @click="showAddModal = true"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
      >
        + Add Schedule
      </button>
    </div>

    <!-- Tasks List -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-gray-400">
        Loading...
      </div>

      <div v-else-if="tasks.length === 0" class="p-8 text-center text-gray-400">
        No scheduled tasks. Click "Add Schedule" to create one.
      </div>

      <div v-else class="divide-y divide-gray-700">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="p-4 hover:bg-gray-750 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ task.enabled ? '🔄' : '⏸️' }}</span>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ task.name }}</span>
                  <span 
                    :class="['text-xs px-2 py-0.5 rounded', task.enabled ? 'bg-green-900/30 text-green-400' : 'bg-gray-900 text-gray-500']"
                  >
                    {{ task.enabled ? 'Active' : 'Paused' }}
                  </span>
                </div>
                <div class="text-sm text-gray-400">
                  {{ task.task_type === 'library_scan' ? '📚 Library Scan' : '🔃 Full Rescan' }}
                  <span v-if="task.library_name"> → {{ task.library_name }}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">
                  Every {{ formatInterval(task.interval_minutes) }}
                  <span v-if="task.last_run_at"> • Last: {{ formatDate(task.last_run_at) }}</span>
                  <span v-if="task.next_run_at"> • Next: {{ formatDate(task.next_run_at) }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="toggleEnabled(task)"
                class="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {{ task.enabled ? '⏸️ Pause' : '▶️ Enable' }}
              </button>
              <button
                @click="runNow(task)"
                :disabled="running === task.id"
                class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
              >
                {{ running === task.id ? '...' : '▶️ Run Now' }}
              </button>
              <button
                @click="deleteTask(task)"
                class="px-3 py-1 text-sm bg-gray-700 hover:bg-red-600 rounded transition-colors"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-medium mb-4">Add Scheduled Task</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Name</label>
            <input
              v-model="newTask.name"
              type="text"
              placeholder="e.g. Nightly Library Scan"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Task Type</label>
            <select
              v-model="newTask.task_type"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="library_scan">Library Scan</option>
              <option value="full_rescan">Full Rescan</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Library</label>
            <select
              v-model="newTask.library_id"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option :value="null">All Libraries</option>
              <option v-for="lib in libraries" :key="lib.id" :value="lib.id">
                {{ lib.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Interval (minutes)</label>
            <select
              v-model="newTask.interval_minutes"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option :value="30">Every 30 minutes</option>
              <option :value="60">Every hour</option>
              <option :value="120">Every 2 hours</option>
              <option :value="360">Every 6 hours</option>
              <option :value="720">Every 12 hours</option>
              <option :value="1440">Daily</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button
            @click="showAddModal = false"
            class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="createTask"
            :disabled="!newTask.name"
            class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'

const toast = useToast()

const loading = ref(true)
const tasks = ref([])
const libraries = ref([])
const showAddModal = ref(false)
const running = ref(null)
const newTask = ref({
  name: '',
  task_type: 'library_scan',
  library_id: null,
  interval_minutes: 360
})

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    const [tasksRes, libsRes] = await Promise.all([
      api.getScheduledTasks(),
      api.getLibraries()
    ])
    tasks.value = tasksRes.data
    libraries.value = libsRes.data
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    loading.value = false
  }
}

const createTask = async () => {
  try {
    await api.createScheduledTask(newTask.value)
    await loadData()
    showAddModal.value = false
    newTask.value = { name: '', task_type: 'library_scan', library_id: null, interval_minutes: 360 }
    toast.success('Schedule created')
  } catch (error) {
    toast.error(error.response?.data?.error || 'Failed to create schedule')
  }
}

const toggleEnabled = async (task) => {
  try {
    await api.updateScheduledTask(task.id, { enabled: !task.enabled })
    await loadData()
    toast.success(task.enabled ? 'Schedule paused' : 'Schedule enabled')
  } catch (error) {
    toast.error('Failed to update schedule')
  }
}

const runNow = async (task) => {
  running.value = task.id
  try {
    await api.runScheduledTask(task.id)
    await loadData()
    toast.success('Task executed')
  } catch (error) {
    toast.error('Failed to run task')
  } finally {
    running.value = null
  }
}

const deleteTask = async (task) => {
  if (!confirm(`Delete schedule "${task.name}"?`)) return
  try {
    await api.deleteScheduledTask(task.id)
    await loadData()
    toast.success('Schedule deleted')
  } catch (error) {
    toast.error('Failed to delete schedule')
  }
}

const formatInterval = (minutes) => {
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)} day(s)`
  if (minutes >= 60) return `${Math.floor(minutes / 60)} hour(s)`
  return `${minutes} min`
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}
</script>
