/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCommandCenterOperations } from '@/composables/useCommandCenterOperations'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    cancelQueueTask: vi.fn(),
    cancelAllPendingTasks: vi.fn(),
    processEnrichmentRetries: vi.fn(),
    retryQueueTask: vi.fn(),
    dismissQueueTask: vi.fn(),
    retryAllFailedTasks: vi.fn(),
  },
}))

vi.mock('@/api', () => ({
  default: apiMock,
}))

describe('useCommandCenterOperations composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps queue actions with busy state and refresh behavior', async () => {
    const pendingQueueTasks = ref([{ id: 11 }, { id: 22 }])
    const refreshOperationalData = vi.fn().mockResolvedValue(undefined)
    const router = { push: vi.fn() }

    apiMock.cancelQueueTask.mockResolvedValue(undefined)

    const {
      cancelPendingTask,
      isActionBusy,
    } = useCommandCenterOperations({
      pendingQueueTasks,
      refreshOperationalData,
      router,
    })

    const pendingPromise = cancelPendingTask(11)
    expect(isActionBusy('cancel-first')).toBe(true)

    await pendingPromise

    expect(apiMock.cancelQueueTask).toHaveBeenCalledWith(11)
    expect(refreshOperationalData).toHaveBeenCalledTimes(1)
    expect(isActionBusy('cancel-first')).toBe(false)
  })

  it('captures action failures as user-facing error state', async () => {
    const pendingQueueTasks = ref([])
    const refreshOperationalData = vi.fn().mockResolvedValue(undefined)
    const router = { push: vi.fn() }

    apiMock.retryAllFailedTasks.mockRejectedValue(new Error('Queue unavailable'))

    const {
      actionError,
      retryAllFailed,
    } = useCommandCenterOperations({
      pendingQueueTasks,
      refreshOperationalData,
      router,
    })

    await retryAllFailed()

    expect(actionError.value).toBe('Queue unavailable')
    expect(refreshOperationalData).not.toHaveBeenCalled()
  })

  it('provides shared formatting and task payload helpers for the command center view', () => {
    const pendingQueueTasks = ref([])
    const refreshOperationalData = vi.fn().mockResolvedValue(undefined)
    const router = { push: vi.fn() }

    const {
      formatDurationMs,
      formatMediaType,
      formatNumber,
      formatPercentOrDash,
      formatRelativeTime,
      openMediaServerSettings,
      safePercent,
      taskMediaType,
      taskTitle,
      truncateError,
    } = useCommandCenterOperations({
      pendingQueueTasks,
      refreshOperationalData,
      router,
    })

    expect(safePercent(101.2)).toBe(100)
    expect(formatPercentOrDash('not-a-number')).toBe('--')
    expect(formatNumber(12345)).toBe('12,345')
    expect(formatDurationMs(1534)).toBe('1.5s')
    expect(formatMediaType('tv')).toBe('TV')
    expect(formatRelativeTime(new Date(Date.now() - 65_000).toISOString())).toBe('1m ago')
    expect(truncateError('x'.repeat(130))).toHaveLength(123)
    expect(taskTitle({ id: 9, payload: JSON.stringify({ media: { title: 'Arrival' } }) })).toBe('Arrival')
    expect(taskMediaType({ payload: { request: { media: { mediaType: 'series' } } } })).toBe('tv')

    openMediaServerSettings()
    expect(router.push).toHaveBeenCalledWith({ path: '/settings', query: { tab: 'media-server' } })
  })
})
