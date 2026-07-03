/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useProcessingDetails } from '@/composables/useProcessingDetails'

describe('useProcessingDetails composable', () => {
  it('computes the processing stage rows and summaries from task state', () => {
    const activeProcessingTasks = ref([
      {
        taskId: 42,
        currentStage: 'rag_analysis',
        stageIndex: 4,
        stages: [
          { name: 'queued', status: 'complete', duration_ms: 500 },
          { name: 'metadata_fetch', status: 'complete', duration_ms: 1000 },
          { name: 'policy_eval', status: 'complete', duration_ms: 1500 },
          { name: 'rag_analysis', status: 'in_progress', label: 'RAG Analysis' },
          { name: 'signal_combine', status: 'pending' },
        ],
      },
    ])
    const isMobileViewport = ref(false)

    const { completedStageCount, nextStageLabel, stageRows } = useProcessingDetails({
      activeProcessingTasks,
      isMobileViewport,
    })

    const rows = stageRows(activeProcessingTasks.value[0])

    expect(rows).toHaveLength(8)
    expect(rows[0]).toMatchObject({ name: 'queued', status: 'complete', timing: '0.5s' })
    expect(rows[3]).toMatchObject({ name: 'rag_analysis', status: 'in_progress', timing: 'running...' })
    expect(rows[4]).toMatchObject({ name: 'signal_combine', status: 'pending' })
    expect(completedStageCount(activeProcessingTasks.value[0])).toBe(3)
    expect(nextStageLabel(activeProcessingTasks.value[0])).toBe('Signal Combination')
  })

  it('toggles the selected processing task and clears it on close', () => {
    const activeProcessingTasks = ref([
      { taskId: 1, title: 'Task One', currentStage: 'queued', stages: [] },
      { taskId: 2, title: 'Task Two', currentStage: 'queued', stages: [] },
    ])
    const isMobileViewport = ref(false)

    const {
      closeProcessingDetails,
      openProcessingDetails,
      processingDetailTask,
    } = useProcessingDetails({
      activeProcessingTasks,
      isMobileViewport,
    })

    openProcessingDetails(2)
    expect(processingDetailTask.value?.taskId).toBe(2)

    openProcessingDetails(2)
    expect(processingDetailTask.value).toBeNull()

    openProcessingDetails(1)
    closeProcessingDetails()
    expect(processingDetailTask.value).toBeNull()
  })

  it('derives stage statuses from stageIndex when currentStage is absent', () => {
    const activeProcessingTasks = ref([
      { taskId: 10, stageIndex: 4, stages: [], currentStage: null },
    ])
    const isMobileViewport = ref(false)

    const { stageRows } = useProcessingDetails({ activeProcessingTasks, isMobileViewport })

    const rows = stageRows(activeProcessingTasks.value[0])

    expect(rows[0].status).toBe('complete')
    expect(rows[2].status).toBe('complete')
    expect(rows[3].status).toBe('in_progress')
    expect(rows[4].status).toBe('pending')

    const rowsFresh = stageRows({ stageIndex: 0, stages: [], currentStage: null })
    expect(rowsFresh[0].status).toBe('in_progress')
    expect(rowsFresh[1].status).toBe('pending')
  })

  it('keeps compatibility with legacy phase-shaped task progress', () => {
    const activeProcessingTasks = ref([
      { taskId: 11, phaseIndex: 2, phases: [], currentPhase: 'metadata_fetch' },
    ])
    const isMobileViewport = ref(false)

    const { stageRows } = useProcessingDetails({ activeProcessingTasks, isMobileViewport })

    const rows = stageRows(activeProcessingTasks.value[0])

    expect(rows[0].status).toBe('complete')
    expect(rows[1].status).toBe('in_progress')
    expect(rows[2].status).toBe('pending')
  })
})
