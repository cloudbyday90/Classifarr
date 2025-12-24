<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold mb-2">Scheduled Tasks</h2>
        <p class="text-gray-400 text-sm">Automate library scans and classifications with timed jobs</p>
      </div>
      <Button 
        v-if="!loading && tasks.length > 0" 
        @click="showAddModal = true" 
        variant="primary"
      >
        + Add Schedule
      </Button>
    </div>

    <!-- Tasks List -->
    <Card class="overflow-hidden p-0">
      <div v-if="loading" class="p-8 text-center text-gray-400">
        <Spinner />
      </div>

      <div v-else-if="tasks.length === 0" class="p-12 text-center text-gray-500 bg-gray-900/30 rounded-lg m-4 border border-dashed border-gray-700">
        <div class="text-4xl mb-3">🕰️</div>
        <h3 class="text-lg font-medium text-gray-300 mb-1">No tasks scheduled</h3>
        <p class="text-sm text-gray-400 mb-4">Create a schedule to automate library maintenance</p>
        <Button @click="showAddModal = true" variant="secondary">
          Create First Schedule
        </Button>
      </div>

      <div v-else class="divide-y divide-gray-700">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="p-4 hover:bg-gray-750 transition-colors flex flex-col md:flex-row md:items-center gap-4"
        >
          <div class="flex items-center gap-3 flex-1">
            <div :class="['p-2 rounded-lg', task.enabled ? 'bg-blue-900/20 text-blue-400' : 'bg-gray-700/30 text-gray-500']">
               <span class="text-xl">
                 {{ task.task_type === 'library_scan' ? '📚' : task.task_type === 'pattern_analysis' ? '📊' : '🔃' }}
               </span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-200">{{ task.name }}</span>
                <span 
                  :class="['text-xs px-2 py-0.5 rounded-full border', task.enabled ? 'bg-green-900/30 border-green-900 text-green-400' : 'bg-gray-700/30 border-gray-600 text-gray-400']"
                >
                  {{ task.enabled ? 'Active' : 'Paused' }}
                </span>
                <span v-if="task.task_type === 'full_rescan'" class="text-xs bg-yellow-900/30 border border-yellow-900 text-yellow-400 px-2 py-0.5 rounded-full">
                  Full Rescan
                </span>
              </div>
              <div class="text-sm text-gray-400 mt-0.5">
                <span v-if="task.library_name">Library: {{ task.library_name }}</span>
                <span v-else>All Libraries</span>
                <span class="mx-2 text-gray-600">•</span>
                <span>Runs every {{ formatInterval(task.interval_minutes) }}</span>
              </div>
              <div class="text-xs text-gray-500 mt-1 flex gap-3">
                <span v-if="task.last_run_at">Last: {{ formatDate(task.last_run_at) }}</span>
                <span v-if="task.next_run_at" class="text-blue-400/80">Next: {{ formatDate(task.next_run_at) }}</span>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-2 justify-end">
            <button
              @click="toggleEnabled(task)"
              :class="['p-2 rounded-lg transition-colors border', task.enabled ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-yellow-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-green-500']"
              :title="task.enabled ? 'Pause Task' : 'Enable Task'"
            >
              {{ task.enabled ? '⏸️' : '▶️' }}
            </button>
            <button
              @click="runNow(task)"
              :disabled="running === task.id"
              class="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed border border-blue-500 text-white transition-colors"
              title="Run Now"
            >
               <span v-if="running === task.id">⏳</span>
               <span v-else>⚡</span>
            </button>
            <button
              @click="deleteTask(task)"
              class="p-2 rounded-lg bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 transition-colors"
              title="Delete Task"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Add Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700 shadow-xl">
        <h3 class="text-lg font-medium mb-4">Add Scheduled Task</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Task Name</label>
            <input
              v-model="newTask.name"
              type="text"
              placeholder="e.g. Nightly Library Scan"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Task Type</label>
            <select
              v-model="newTask.task_type"
              class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="library_scan">📚 Library Scan (Incremental)</option>
              <option value="full_rescan">🔃 Full Rescan (Re-analyze all)</option>
              <option value="pattern_analysis">📊 Pattern Analysis (Detect new filters)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Target Library</label>
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
            <label class="block text-sm font-medium mb-2">Frequency</label>
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
              <option :value="10080">Weekly</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <Button @click="showAddModal = false" variant="secondary" class="flex-1">
            Cancel
          </Button>
          <Button 
            @click="createTask" 
            :disabled="!newTask.name" 
            variant="primary" 
            class="flex-1"
          >
            Create Schedule
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { useToast } from '@/stores/toast'
import { Card, Button, Spinner } from '@/components/common'

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
    toast.error('Failed to load scheduled tasks')
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
    toast.success('Task execution started')
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
  if (minutes >= 10080) return 'week'
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)} day(s)`
  if (minutes >= 60) return `${Math.floor(minutes / 60)} hour(s)`
  return `${minutes} min`
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}
</script>
