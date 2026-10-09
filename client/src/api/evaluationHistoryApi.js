/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest } from './core'

/** v4 activity may include inventory readiness; this GET never starts capture or replay. */
export function getEvaluationHistory() {
  return getDataRequest('/stats/evaluation-history')
}

export default { getEvaluationHistory }
