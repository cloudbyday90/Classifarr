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

import { ref } from 'vue'
import {
  useBoundedVisiblePageRefresh,
} from './useBoundedVisiblePageRefresh'

export const AI_READINESS_AUTO_REFRESH_INTERVAL_MS = 2 * 60 * 1000

/**
 * Owns the bounded, read-only refresh lifecycle for the authoritative AI
 * readiness projection. It deliberately has no model-test, save, discovery,
 * or routing authority.
 *
 * @param {{
 *   refresh: () => Promise<unknown>,
 *   autoRefreshEnabled?: import('vue').Ref<boolean>,
 *   refreshIntervalMs?: number,
 * }} options
 */
export function useAiReadinessAutoRefresh({
  refresh,
  autoRefreshEnabled = ref(true),
  refreshIntervalMs = AI_READINESS_AUTO_REFRESH_INTERVAL_MS,
} = {}) {
  if (typeof refresh !== 'function') {
    throw new TypeError('AI readiness auto refresh requires a refresh function.')
  }

  const refreshState = useBoundedVisiblePageRefresh({
    refresh,
    autoRefreshEnabled,
    refreshIntervalMs,
  })

  return {
    ...refreshState,
    markReadinessUpdated: refreshState.markUpdated,
    refreshReadiness: refreshState.refreshNow,
  }
}
