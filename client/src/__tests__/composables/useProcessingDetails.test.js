/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useProcessingDetails } from '@/composables/useProcessingDetails'

describe('useProcessingDetails composable', () => {
  it('computes the processing phase rows and summaries from task state', () => {
    const activeProcessingTasks = ref([
      {
        taskId: 42,
        currentPhase: 'rag_analysis',
        phaseIndex: 4,
        phases: [
          { name: 'queued', status: 'complete', duration_ms: 500 },
          { name: 'metadata_fetch', status: 'complete', duration_ms: 1000 },
          { name: 'policy_eval', status: 'complete', duration_ms: 1500 },
          { name: 'rag_analysis', status: 'in_progress', label: 'RAG Analysis' },
          { name: 'signal_combine', status: 'pending' },
        ],
      },
    ])
    const isMobileViewport = ref(false)

    const { completedPhaseCount, nextPhaseLabel, phaseRows } = useProcessingDetails({
      activeProcessingTasks,
      isMobileViewport,
    })

    const rows = phaseRows(activeProcessingTasks.value[0])

    expect(rows).toHaveLength(8)
    expect(rows[0]).toMatchObject({ name: 'queued', status: 'complete', timing: '0.5s' })
    expect(rows[3]).toMatchObject({ name: 'rag_analysis', status: 'in_progress', timing: 'running...' })
    expect(rows[4]).toMatchObject({ name: 'signal_combine', status: 'pending' })
    expect(completedPhaseCount(activeProcessingTasks.value[0])).toBe(3)
    expect(nextPhaseLabel(activeProcessingTasks.value[0])).toBe('Signal Combination')
  })

  it('toggles the selected processing task and clears it on close', () => {
    const activeProcessingTasks = ref([
      { taskId: 1, title: 'Task One', currentPhase: 'queued', phases: [] },
      { taskId: 2, title: 'Task Two', currentPhase: 'queued', phases: [] },
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

  it('derives phase statuses from phaseIndex when currentPhase is absent', () => {
    const activeProcessingTasks = ref([
      { taskId: 10, phaseIndex: 4, phases: [], currentPhase: null },
    ])
    const isMobileViewport = ref(false)

    const { phaseRows } = useProcessingDetails({ activeProcessingTasks, isMobileViewport })

    const rows = phaseRows(activeProcessingTasks.value[0])

    expect(rows[0].status).toBe('complete')
    expect(rows[2].status).toBe('complete')
    expect(rows[3].status).toBe('in_progress')
    expect(rows[4].status).toBe('pending')

    const rowsFresh = phaseRows({ phaseIndex: 0, phases: [], currentPhase: null })
    expect(rowsFresh[0].status).toBe('in_progress')
    expect(rowsFresh[1].status).toBe('pending')
  })
})
