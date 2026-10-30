/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest, apiClient } from './core'

/** v4 activity may include inventory readiness; this GET never starts capture or replay. */
export function getEvaluationHistory() {
  return getDataRequest('/stats/evaluation-history')
}

export function getEvidenceGapAudit() {
  return getDataRequest('/stats/evidence-gap-audit')
}

export function getPurposeEvaluation() {
  return getDataRequest('/stats/purpose-evaluation')
}

export function getEvaluationWorkload() {
  return getDataRequest('/stats/evaluation-workload')
}

export function updateEvaluationWorkload(configuration) {
  return apiClient.put('/stats/evaluation-workload', configuration)
}

export default { getEvaluationHistory, getEvidenceGapAudit, getPurposeEvaluation, getEvaluationWorkload, updateEvaluationWorkload }
