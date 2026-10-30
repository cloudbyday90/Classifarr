/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
const { getDataRequest, put } = vi.hoisted(() => ({ getDataRequest: vi.fn(), put: vi.fn() }))
vi.mock('@/api/core', () => ({ getDataRequest, apiClient: { put } }))
import api from '@/api'
import leaf, { getEvaluationHistory, getEvaluationWorkload, updateEvaluationWorkload, getEvidenceGapAudit, getPurposeEvaluation } from '@/api/evaluationHistoryApi'

it('wires the saved purpose summary through the leaf, aggregator and barrel', async () => {
  const result = { status: 'never_run' }; getDataRequest.mockResolvedValue(result)
  expect(api.getPurposeEvaluation).toBe(getPurposeEvaluation)
  expect(leaf.getPurposeEvaluation).toBe(getPurposeEvaluation)
  expect(await api.getPurposeEvaluation()).toBe(result)
  expect(getDataRequest).toHaveBeenLastCalledWith('/stats/purpose-evaluation')
})

it('wires the saved audit through the leaf, aggregator and barrel', async () => {
  const result = { status: 'never_run' }
  getDataRequest.mockResolvedValue(result)
  expect(api.getEvidenceGapAudit).toBe(getEvidenceGapAudit)
  expect(leaf.getEvidenceGapAudit).toBe(getEvidenceGapAudit)
  expect(await api.getEvidenceGapAudit()).toBe(result)
  expect(getDataRequest).toHaveBeenLastCalledWith('/stats/evidence-gap-audit')
})

it('wires the named read through the stats aggregator and barrel', async () => {
  const response = { version: 'evaluation_history_summary.v4', groups: [],
    activity: { inventory: { version: 'evaluation_inventory_readiness.v1', status: 'backfilling' } } }
  getDataRequest.mockResolvedValue(response)
  expect(api.getEvaluationHistory).toBe(getEvaluationHistory)
  expect(leaf.getEvaluationHistory).toBe(getEvaluationHistory)
  expect(await api.getEvaluationHistory()).toBe(response)
  expect(getDataRequest).toHaveBeenCalledWith('/stats/evaluation-history')
})

it('centralizes workload reads and preserves raw mutation responses', async () => {
  const configuration = { revision: 0, mode: 'off', dailyRequests: 0, startMinute: null, endMinute: null }
  getDataRequest.mockResolvedValue(configuration)
  put.mockResolvedValue({ data: configuration })
  expect(api.getEvaluationWorkload).toBe(getEvaluationWorkload)
  expect(api.updateEvaluationWorkload).toBe(updateEvaluationWorkload)
  expect(await getEvaluationWorkload()).toBe(configuration)
  expect(getDataRequest).toHaveBeenLastCalledWith('/stats/evaluation-workload')
  expect(await updateEvaluationWorkload(configuration)).toEqual({ data: configuration })
  expect(put).toHaveBeenLastCalledWith('/stats/evaluation-workload', configuration)
})
