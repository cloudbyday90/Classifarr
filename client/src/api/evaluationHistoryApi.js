/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest } from './core'

/** Read the versioned aggregate (v4 adds activity); never start capture or replay. */
export function getEvaluationHistory() {
  return getDataRequest('/stats/evaluation-history')
}

export default { getEvaluationHistory }
