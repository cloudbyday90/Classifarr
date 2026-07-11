/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { computed, nextTick, ref, watch } from 'vue'

const stageLabels = Object.freeze({
  queued: 'Queued',
  metadata_fetch: 'Metadata Fetch',
  policy_eval: 'Policy Evaluation',
  rag_analysis: 'RAG Analysis',
  signal_combine: 'Signal Combination',
  ai_analysis: 'AI Analysis',
  decision: 'Decision',
  notification: 'Notification',
})

const lockedStageOrder = Object.freeze([
  'queued',
  'metadata_fetch',
  'policy_eval',
  'rag_analysis',
  'signal_combine',
  'ai_analysis',
  'decision',
  'notification',
])

function stageLabel(stageId) {
  return stageLabels[stageId] || stageId || 'Unknown'
}

function formatDurationMs(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) && n > 0 ? `${(n / 1000).toFixed(1)}s` : '0.0s'
}

function taskStages(task) {
  return Array.isArray(task?.stages) ? task.stages : []
}

function taskCurrentStage(task) {
  return task?.currentStage || null
}

function taskStageIndex(task) {
  return Number(task?.stageIndex || 0)
}

function stageRows(task) {
  const stages = taskStages(task)
  const stageByName = new Map(stages.map((stage) => [stage.name, stage]))
  const currentStage = taskCurrentStage(task)
  const currentStageIndex = lockedStageOrder.indexOf(currentStage)
  const stageIndex = taskStageIndex(task)

  return lockedStageOrder.map((stageName, index) => {
    const source = stageByName.get(stageName) || {}
    let status = source.status

    if (!status) {
      if (currentStageIndex >= 0) {
        if (index < currentStageIndex) status = 'complete'
        else if (index === currentStageIndex) status = 'in_progress'
        else status = 'pending'
      } else if (stageIndex > 0) {
        if (index < stageIndex - 1) status = 'complete'
        else if (index === stageIndex - 1) status = 'in_progress'
        else status = 'pending'
      } else {
        status = index === 0 ? 'in_progress' : 'pending'
      }
    }

    const timing = status === 'in_progress'
      ? 'running...'
      : (status === 'complete' && Number.isFinite(Number(source.duration_ms))
        ? formatDurationMs(source.duration_ms)
        : (status === 'skipped' ? 'skipped' : ''))

    return {
      name: stageName,
      label: source.label || stageLabel(stageName),
      status,
      timing,
    }
  })
}

function completedStageCount(task) {
  return taskStages(task).filter((stage) => stage.status === 'complete').length
}

function nextStageLabel(task) {
  const next = taskStages(task).find((stage) => stage.status === 'pending')
  return next ? (next.label || stageLabel(next.name)) : 'Complete'
}

export function useProcessingDetails({ activeProcessingTasks, isMobileViewport }) {
  const expandedProcessingTaskId = ref(null)
  const processingDetailTriggerRef = ref(null)

  const processingDetailTask = computed(() => {
    if (!expandedProcessingTaskId.value) return null
    return activeProcessingTasks.value.find((task) => (task.taskId || task.id) === expandedProcessingTaskId.value) || null
  })

  const showProcessingBottomSheet = computed(() => Boolean(isMobileViewport.value && processingDetailTask.value))

  function openProcessingDetails(taskId, event = null) {
    const isClosingCurrentTask = expandedProcessingTaskId.value === taskId
    if (!isClosingCurrentTask && event?.currentTarget) {
      processingDetailTriggerRef.value = event.currentTarget
    }
    expandedProcessingTaskId.value = isClosingCurrentTask ? null : taskId
  }

  function closeProcessingDetails() {
    expandedProcessingTaskId.value = null
  }

  watch(showProcessingBottomSheet, async (isOpen, wasOpen) => {
    if (!isOpen && wasOpen) {
      await nextTick()
      processingDetailTriggerRef.value?.focus?.()
    }
  })

  watch(processingDetailTask, (task) => {
    if (!task && expandedProcessingTaskId.value) {
      expandedProcessingTaskId.value = null
    }
  })

  return {
    closeProcessingDetails,
    completedStageCount,
    expandedProcessingTaskId,
    nextStageLabel,
    openProcessingDetails,
    stageLabel,
    stageRows,
    processingDetailTask,
    processingDetailTriggerRef,
    showProcessingBottomSheet,
  }
}
