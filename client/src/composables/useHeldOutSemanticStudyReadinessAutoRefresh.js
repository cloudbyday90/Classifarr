/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import {
  useBoundedVisiblePageRefresh,
} from './useBoundedVisiblePageRefresh'

export const HELD_OUT_SEMANTIC_STUDY_READINESS_AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

/**
 * Refreshes only the existing aggregate readiness read while its page is
 * visible. Initial loading remains owned by the reconciliation view so this
 * wrapper cannot duplicate, schedule, or advance the held-out study workflow.
 */
export function useHeldOutSemanticStudyReadinessAutoRefresh({
  refresh,
  autoRefreshEnabled = ref(true),
  refreshIntervalMs = HELD_OUT_SEMANTIC_STUDY_READINESS_AUTO_REFRESH_INTERVAL_MS,
} = {}) {
  if (typeof refresh !== 'function') {
    throw new TypeError('Held-out semantic study readiness auto refresh requires a refresh function.')
  }

  const refreshState = useBoundedVisiblePageRefresh({
    refresh,
    autoRefreshEnabled,
    refreshIntervalMs,
    refreshOnMounted: false,
    refreshOnWindowFocus: false,
  })

  return {
    ...refreshState,
    refreshReadiness: refreshState.refreshNow,
  }
}
