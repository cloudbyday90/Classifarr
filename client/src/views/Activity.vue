<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold mb-2">Activity</h1>
      <p class="text-gray-400">Monitor real-time classification activity and queue status</p>
    </div>

    <!-- Queue Section -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Queue</h2>
        <span class="text-sm text-gray-400">{{ queueItems.length }} items</span>
      </div>

      <div v-if="queueItems.length === 0" class="text-center py-8 text-gray-400">
        <ClockIcon class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No items in queue</p>
      </div>

      <div v-else class="space-y-3">
        <div 
          v-for="item in queueItems" 
          :key="item.id"
          class="flex items-center justify-between p-4 bg-background rounded-lg border border-gray-800"
        >
          <div class="flex items-center space-x-4">
            <div class="animate-spin">
              <ArrowPathIcon class="w-5 h-5 text-primary" />
            </div>
            <div>
              <p class="font-medium">{{ item.title }}</p>
              <p class="text-sm text-gray-400">{{ item.status }}</p>
            </div>
          </div>
          <div class="text-sm text-gray-400">
            {{ item.time }}
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Recent Activity</h2>
        <button 
          @click="refreshActivity"
          class="text-sm text-primary hover:text-primary-light transition-colors"
        >
          Refresh
        </button>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-400">
        <ArrowPathIcon class="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p>Loading activity...</p>
      </div>

      <div v-else-if="recentActivity.length === 0" class="text-center py-8 text-gray-400">
        <BellIcon class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No recent activity</p>
      </div>

      <div v-else class="space-y-3">
        <div 
          v-for="activity in recentActivity" 
          :key="activity.id"
          class="flex items-start space-x-4 p-4 bg-background rounded-lg border border-gray-800"
        >
          <div class="flex-shrink-0 mt-1">
            <CheckCircleIcon v-if="activity.type === 'success'" class="w-5 h-5 text-green-500" />
            <ExclamationCircleIcon v-else-if="activity.type === 'error'" class="w-5 h-5 text-red-500" />
            <InformationCircleIcon v-else class="w-5 h-5 text-blue-500" />
          </div>
          <div class="flex-1">
            <p class="font-medium">{{ activity.title }}</p>
            <p class="text-sm text-gray-400 mt-1">{{ activity.description }}</p>
            <div class="flex items-center space-x-4 mt-2 text-xs text-gray-500">
              <span>{{ activity.library }}</span>
              <span>{{ activity.time }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Updates Section -->
    <div class="bg-card rounded-lg border border-gray-800 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Live Updates</h2>
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span class="text-sm text-gray-400">Live</span>
        </div>
      </div>

      <div class="space-y-2">
        <div 
          v-for="update in liveUpdates" 
          :key="update.id"
          class="flex items-center justify-between p-3 bg-background rounded border border-gray-800 text-sm"
        >
          <span class="text-gray-300">{{ update.message }}</span>
          <span class="text-gray-500">{{ update.timestamp }}</span>
        </div>
        <div v-if="liveUpdates.length === 0" class="text-center py-4 text-gray-400 text-sm">
          Waiting for updates...
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { 
  ClockIcon, 
  ArrowPathIcon, 
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline'

const loading = ref(false)
const queueItems = ref([])
const recentActivity = ref([])
const liveUpdates = ref([])

let refreshInterval = null

const fetchActivity = async () => {
  loading.value = true
  try {
    // Fetch recent classification history
    const response = await fetch('/api/classification/history?limit=10')
    const data = await response.json()
    
    recentActivity.value = data.history.map(item => ({
      id: item.id,
      title: item.title,
      description: `Classified to ${item.library_name} with ${Math.round(item.confidence * 100)}% confidence`,
      library: item.library_name,
      time: new Date(item.created_at).toLocaleString(),
      type: item.confidence > 0.8 ? 'success' : 'info'
    }))
  } catch (error) {
    console.error('Failed to fetch activity:', error)
  } finally {
    loading.value = false
  }
}

const refreshActivity = () => {
  fetchActivity()
}

onMounted(() => {
  fetchActivity()
  // Refresh every 30 seconds
  refreshInterval = setInterval(fetchActivity, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
