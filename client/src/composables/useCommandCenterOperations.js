/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import api from '@/api'

export function useCommandCenterOperations({
  pendingQueueTasks,
  refreshOperationalData,
  router,
}) {
  const actionError = ref('')
  const actionBusy = ref({})

  function isActionBusy(key) {
    return Boolean(actionBusy.value[key])
  }

  async function runActionWithBusy(key, actionFn, refreshFn = refreshOperationalData) {
    actionError.value = ''
    actionBusy.value = { ...actionBusy.value, [key]: true }
    try {
      await actionFn()
      if (refreshFn) {
        await refreshFn()
      }
    } catch (error) {
      actionError.value = error?.response?.data?.error || error?.message || 'Action failed'
    } finally {
      actionBusy.value = { ...actionBusy.value, [key]: false }
    }
  }

  function safePercent(value) {
    const n = Number(value || 0)
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
  }

  function formatPercentOrDash(value) {
    if (!Number.isFinite(Number(value))) return '--'
    return `${safePercent(value)}%`
  }

  function formatDurationMs(value) {
    const n = Number(value || 0)
    return Number.isFinite(n) && n > 0 ? `${(n / 1000).toFixed(1)}s` : '0.0s'
  }

  function formatNumber(value) {
    const n = Number(value || 0)
    return Number.isFinite(n) ? n.toLocaleString() : '0'
  }

  function formatMediaType(value) {
    if (!value) return 'Unknown'
    return value === 'tv' ? 'TV' : `${value.charAt(0).toUpperCase()}${value.slice(1)}`
  }

  function formatRelativeTime(value) {
    if (!value) return 'unknown time'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'unknown time'
    const diffMs = Math.max(0, Date.now() - date.getTime())
    const sec = Math.floor(diffMs / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    return `${Math.floor(hr / 24)}d ago`
  }

  function truncateError(message, maxLength = 120) {
    if (!message) return 'No error details available.'
    return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message
  }

  function parseTaskPayload(task) {
    if (!task?.payload) return {}
    if (typeof task.payload === 'object') return task.payload
    try {
      return JSON.parse(task.payload)
    } catch {
      return {}
    }
  }

  function taskTitle(task) {
    const payload = parseTaskPayload(task)
    return payload.title || payload.media?.title || payload.subject || task.title || `Task #${task.id}`
  }

  function taskMediaType(task) {
    const payload = parseTaskPayload(task)
    const type = payload?.media?.media_type
      || payload?.media_type
      || payload?.mediaType
      || payload?.subject?.mediaType
      || payload?.request?.media?.mediaType
      || payload?.type
      || null
    return type === 'series' ? 'tv' : type
  }

  async function cancelPendingTask(taskId) {
    const firstPendingTaskId = pendingQueueTasks.value[0]?.id
    const actionKey = taskId === firstPendingTaskId ? 'cancel-first' : `cancel-${taskId}`
    await runActionWithBusy(actionKey, async () => {
      await api.cancelQueueTask(taskId)
    })
  }

  async function cancelAllPendingTasks() {
    await runActionWithBusy('cancel-all', async () => {
      await api.cancelAllPendingTasks()
    })
  }

  async function processEnrichmentRetries(type = 'tavily') {
    await runActionWithBusy(`process-enrichment-retries-${type}`, async () => {
      await api.processEnrichmentRetries({ limit: 50, enrichmentType: type })
    })
  }

  async function retryFailedTask(taskId) {
    await runActionWithBusy(`retry-failed-${taskId}`, async () => {
      await api.retryQueueTask(taskId)
    })
  }

  async function dismissFailedTask(taskId) {
    await runActionWithBusy(`dismiss-failed-${taskId}`, async () => {
      await api.dismissQueueTask(taskId)
    })
  }

  async function retryAllFailed() {
    await runActionWithBusy('retry-all-failed', async () => {
      await api.retryAllFailedTasks()
    })
  }

  function openMediaServerSettings() {
    router.push({ path: '/settings', query: { tab: 'mediaserver' } })
  }

  return {
    actionError,
    actionBusy,
    cancelAllPendingTasks,
    cancelPendingTask,
    dismissFailedTask,
    formatDurationMs,
    formatMediaType,
    formatNumber,
    formatPercentOrDash,
    formatRelativeTime,
    isActionBusy,
    openMediaServerSettings,
    processEnrichmentRetries,
    retryAllFailed,
    retryFailedTask,
    runActionWithBusy,
    safePercent,
    taskMediaType,
    taskTitle,
    truncateError,
  }
}
