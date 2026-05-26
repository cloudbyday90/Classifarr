/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { computed, nextTick, ref, watch } from 'vue'

const phaseLabels = Object.freeze({
  queued: 'Queued',
  metadata_fetch: 'Metadata Fetch',
  policy_eval: 'Policy Evaluation',
  rag_analysis: 'RAG Analysis',
  signal_combine: 'Signal Combination',
  ai_analysis: 'AI Analysis',
  decision: 'Decision',
  notification: 'Notification',
})

const lockedPhaseOrder = Object.freeze([
  'queued',
  'metadata_fetch',
  'policy_eval',
  'rag_analysis',
  'signal_combine',
  'ai_analysis',
  'decision',
  'notification',
])

function phaseLabel(phaseId) {
  return phaseLabels[phaseId] || phaseId || 'Unknown'
}

function formatDurationMs(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) && n > 0 ? `${(n / 1000).toFixed(1)}s` : '0.0s'
}

function phaseRows(task) {
  const phases = Array.isArray(task?.phases) ? task.phases : []
  const phaseByName = new Map(phases.map((phase) => [phase.name, phase]))
  const currentPhase = task?.currentPhase || null
  const currentPhaseIndex = lockedPhaseOrder.indexOf(currentPhase)
  const phaseIndex = Number(task?.phaseIndex || 0)

  return lockedPhaseOrder.map((phaseName, index) => {
    const source = phaseByName.get(phaseName) || {}
    let status = source.status

    if (!status) {
      if (currentPhaseIndex >= 0) {
        if (index < currentPhaseIndex) status = 'complete'
        else if (index === currentPhaseIndex) status = 'in_progress'
        else status = 'pending'
      } else if (phaseIndex > 0) {
        if (index < phaseIndex - 1) status = 'complete'
        else if (index === phaseIndex - 1) status = 'in_progress'
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
      name: phaseName,
      label: source.label || phaseLabel(phaseName),
      status,
      timing,
    }
  })
}

function completedPhaseCount(task) {
  return (Array.isArray(task?.phases) ? task.phases : []).filter((phase) => phase.status === 'complete').length
}

function nextPhaseLabel(task) {
  const next = (Array.isArray(task?.phases) ? task.phases : []).find((phase) => phase.status === 'pending')
  return next ? (next.label || phaseLabel(next.name)) : 'Complete'
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
    completedPhaseCount,
    expandedProcessingTaskId,
    nextPhaseLabel,
    openProcessingDetails,
    phaseLabel,
    phaseRows,
    processingDetailTask,
    processingDetailTriggerRef,
    showProcessingBottomSheet,
  }
}
