/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
const getDataRequest = vi.hoisted(() => vi.fn())
vi.mock('@/api/core', () => ({ getDataRequest, apiClient: {} }))
import api from '@/api'
import leaf, { getEvaluationHistory } from '@/api/evaluationHistoryApi'

it('wires the named read through the stats aggregator and barrel', async () => {
  getDataRequest.mockResolvedValue({ groups: [] })
  expect(api.getEvaluationHistory).toBe(getEvaluationHistory)
  expect(leaf.getEvaluationHistory).toBe(getEvaluationHistory)
  expect(await api.getEvaluationHistory()).toEqual({ groups: [] })
  expect(getDataRequest).toHaveBeenCalledWith('/stats/evaluation-history')
})
