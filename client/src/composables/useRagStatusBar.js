import { computed, onMounted, onUnmounted, ref } from 'vue'

import api from '@/api'
import { normalizeRagHeaderStatus } from '@/utils/ragStatusUi'

export function useRagStatusBar(apiClient = api, refreshIntervalMs = 5000) {
  const statusBar = ref({
    textOnline: false,
    imageState: 'disabled',
    imageOnline: false,
    heartbeatActive: false,
    queueText: 0,
    queueImage: 0,
    totalTextEmbeddings: 0,
    totalImageEmbeddings: 0,
  })

  let statusInterval = null

  const loadStatusBar = async () => {
    try {
      const [statusRes, backfillRes, heartbeatRes] = await Promise.all([
        apiClient.getRagStatus(),
        apiClient.getBackfillStatus(),
        apiClient.getSystemHeartbeat(),
      ])

      statusBar.value = normalizeRagHeaderStatus({
        statusData: statusRes.data,
        backfillData: backfillRes.data,
        heartbeatData: heartbeatRes.data,
      })
    } catch (error) {
      console.error('Failed to load status bar:', error)
    }
  }

  const imageStatusLabel = computed(() => {
    switch (statusBar.value.imageState) {
      case 'disabled':
        return 'Disabled'
      case 'configured':
        return 'Configured'
      case 'not_configured':
        return 'Not configured'
      case 'online':
        return 'Online'
      default:
        return 'Offline'
    }
  })

  const imageStatusDotClass = computed(() => {
    switch (statusBar.value.imageState) {
      case 'disabled':
      case 'not_configured':
        return 'bg-gray-500'
      case 'configured':
        return 'bg-yellow-500'
      case 'online':
        return 'bg-green-500'
      default:
        return 'bg-red-500'
    }
  })

  const imageStatusTextClass = computed(() => {
    switch (statusBar.value.imageState) {
      case 'disabled':
      case 'not_configured':
        return 'text-gray-400'
      case 'configured':
        return 'text-yellow-400'
      case 'online':
        return 'text-green-400'
      default:
        return 'text-red-400'
    }
  })

  onMounted(() => {
    loadStatusBar()
    statusInterval = setInterval(loadStatusBar, refreshIntervalMs)
  })

  onUnmounted(() => {
    if (statusInterval) {
      clearInterval(statusInterval)
    }
  })

  return {
    formatStatusCount,
    imageStatusDotClass,
    imageStatusLabel,
    imageStatusTextClass,
    loadStatusBar,
    statusBar,
  }
}

export function formatStatusCount(num) {
  if (!num) return '0'
  return num.toLocaleString()
}
