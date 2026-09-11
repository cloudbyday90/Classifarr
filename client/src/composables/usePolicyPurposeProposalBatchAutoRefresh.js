/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { ref } from 'vue'
import { useBoundedVisiblePageRefresh } from './useBoundedVisiblePageRefresh'

export const POLICY_PURPOSE_PROPOSAL_BATCH_AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export function usePolicyPurposeProposalBatchAutoRefresh({
  refresh,
  autoRefreshEnabled = ref(true),
  refreshIntervalMs = POLICY_PURPOSE_PROPOSAL_BATCH_AUTO_REFRESH_INTERVAL_MS,
} = {}) {
  if (typeof refresh !== 'function') {
    throw new TypeError('Purpose proposal batch auto refresh requires a refresh function.')
  }

  return useBoundedVisiblePageRefresh({
    refresh,
    autoRefreshEnabled,
    refreshIntervalMs,
    refreshOnMounted: false,
    refreshOnWindowFocus: false,
  })
}
