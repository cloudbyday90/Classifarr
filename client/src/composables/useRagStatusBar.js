/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed, onMounted, onUnmounted, ref } from 'vue'

import api from '@/api'
import { getImageEmbeddingStatusPresentation } from '@/utils/ragEmbeddingDisplay'
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
        statusData: statusRes,
        backfillData: backfillRes,
        heartbeatData: heartbeatRes.data,
      })
    } catch (error) {
      console.error('Failed to load status bar:', error)
    }
  }

  const imageStatusPresentation = computed(() => {
    return getImageEmbeddingStatusPresentation(
      { state: statusBar.value.imageState },
      { configuredLabel: 'Configured' }
    )
  })

  const imageStatusLabel = computed(() => imageStatusPresentation.value.label)
  const imageStatusDotClass = computed(() => imageStatusPresentation.value.dotClass)
  const imageStatusTextClass = computed(() => imageStatusPresentation.value.textClass)

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
