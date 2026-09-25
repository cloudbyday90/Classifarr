/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest } from './core'

export function getEvaluationHistory() {
  return getDataRequest('/stats/evaluation-history')
}

export default { getEvaluationHistory }
