/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest } from './core'

/** Read the versioned aggregate (v3 adds pair origins); never start capture or replay. */
export function getEvaluationHistory() {
  return getDataRequest('/stats/evaluation-history')
}

export default { getEvaluationHistory }
