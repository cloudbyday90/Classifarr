/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import ClassificationStats from '../views/statistics/ClassificationStats.vue'
import api from '../api'

vi.mock('../api', () => ({
  default: {
    getDetailedStats: vi.fn(),
    getSecondPassEvaluation: vi.fn()
  }
}))

vi.mock('../composables/useSWR', () => ({
  useSWR: vi.fn(() => ({
    data: ref({
      overall: {
        total: 100,
        avg_confidence: 82,
        high_confidence: 40,
        low_confidence: 8,
        last_24h: 6,
        last_7d: 22
      },
      daily: [
        { date: '2026-03-20', count: 4, avg_confidence: 80 },
        { date: '2026-03-21', count: 6, avg_confidence: 84 }
      ],
      byMethod: [
        { method: 'policy_engine', count: 70, avg_confidence: 88 }
      ],
      byLibrary: [
        { id: 1, name: 'Movies', count: 60, avg_confidence: 85 }
      ],
      confidenceDistribution: [
        { level: 'high', count: 40 },
        { level: 'medium', count: 52 },
        { level: 'low', count: 8 }
      ],
      queueHealth: {
        pending: 2,
        processing: 1,
        completed_today: 9,
        failed: 1,
        success_rate: 90
      }
    }),
    isLoading: ref(false),
    isStale: ref(false),
    error: ref(null)
  }))
}))

describe('ClassificationStats.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getSecondPassEvaluation.mockResolvedValue({
      data: {
        windowDays: 30,
        totals: {
          total: 50,
          linkedOutcomes: 20,
          verified: 9,
          corrected: 4,
          resolved: 3,
          retried: 4,
          multiStepOutcomes: 6,
          firstOutcomeBreakdown: {
            verified: 7,
            corrected: 6,
            resolved: 3,
            retried: 4
          },
          latestOutcomeBreakdown: {
            verified: 9,
            corrected: 4,
            resolved: 3,
            retried: 4
          },
          perTotal: {
            linkedOutcomeRate: 0.4,
            correctedRate: 0.08,
            verifiedRate: 0.18,
            resolvedRate: 0.06,
            retriedRate: 0.08
          },
          perLinkedOutcome: {
            correctedRate: 0.2,
            verifiedRate: 0.45,
            resolvedRate: 0.15,
            retriedRate: 0.2
          },
          linkedOutcomeRate: 0.4,
          correctedRate: 0.2,
          verifiedRate: 0.45,
          resolvedRate: 0.15,
          retriedRate: 0.2
        },
        cohorts: [
          {
            cohort: 'baseline',
            total: 30,
            linkedOutcomes: 12,
            verified: 5,
            corrected: 3,
            resolved: 2,
            retried: 2,
            multiStepOutcomes: 3,
            firstOutcomeBreakdown: {
              verified: 4,
              corrected: 4,
              resolved: 2,
              retried: 2
            },
            latestOutcomeBreakdown: {
              verified: 5,
              corrected: 3,
              resolved: 2,
              retried: 2
            },
            perTotal: {
              linkedOutcomeRate: 0.4,
              correctedRate: 0.1,
              verifiedRate: 0.1667,
              resolvedRate: 0.0667,
              retriedRate: 0.0667
            },
            perLinkedOutcome: {
              correctedRate: 0.25,
              verifiedRate: 0.4167,
              resolvedRate: 0.1667,
              retriedRate: 0.1667
            },
            linkedOutcomeRate: 0.4,
            correctedRate: 0.25,
            verifiedRate: 0.4167,
            resolvedRate: 0.1667,
            retriedRate: 0.1667
          },
          {
            cohort: 'pass2_not_adopted',
            total: 10,
            linkedOutcomes: 3,
            verified: 1,
            corrected: 1,
            resolved: 0,
            retried: 1,
            multiStepOutcomes: 1,
            firstOutcomeBreakdown: {
              verified: 1,
              corrected: 1,
              resolved: 0,
              retried: 1
            },
            latestOutcomeBreakdown: {
              verified: 1,
              corrected: 1,
              resolved: 0,
              retried: 1
            },
            perTotal: {
              linkedOutcomeRate: 0.3,
              correctedRate: 0.1,
              verifiedRate: 0.1,
              resolvedRate: 0,
              retriedRate: 0.1
            },
            perLinkedOutcome: {
              correctedRate: 0.3333,
              verifiedRate: 0.3333,
              resolvedRate: 0,
              retriedRate: 0.3333
            },
            linkedOutcomeRate: 0.3,
            correctedRate: 0.3333,
            verifiedRate: 0.3333,
            resolvedRate: 0,
            retriedRate: 0.3333
          },
          {
            cohort: 'pass2_adopted',
            total: 10,
            linkedOutcomes: 5,
            verified: 3,
            corrected: 0,
            resolved: 1,
            retried: 1,
            multiStepOutcomes: 2,
            firstOutcomeBreakdown: {
              verified: 2,
              corrected: 1,
              resolved: 1,
              retried: 1
            },
            latestOutcomeBreakdown: {
              verified: 3,
              corrected: 0,
              resolved: 1,
              retried: 1
            },
            perTotal: {
              linkedOutcomeRate: 0.5,
              correctedRate: 0,
              verifiedRate: 0.3,
              resolvedRate: 0.1,
              retriedRate: 0.1
            },
            perLinkedOutcome: {
              correctedRate: 0,
              verifiedRate: 0.6,
              resolvedRate: 0.2,
              retriedRate: 0.2
            },
            linkedOutcomeRate: 0.5,
            correctedRate: 0,
            verifiedRate: 0.6,
            resolvedRate: 0.2,
            retriedRate: 0.2
          }
        ]
      }
    })
  })

  it('renders the second-pass evaluation section with cohort metrics', async () => {
    const wrapper = mount(ClassificationStats)
    await flushPromises()

    expect(api.getSecondPassEvaluation).toHaveBeenCalledWith(30)
    expect(wrapper.text()).toContain('Second-Pass Evaluation')
    expect(wrapper.text()).toContain('Pass2 Adopted')
    expect(wrapper.text()).toContain('Correction Delta')
    expect(wrapper.text()).toContain('Baseline')
    expect(wrapper.text()).toContain('Pass2 Ran, Baseline Kept')
    expect(wrapper.text()).toContain('50')
    expect(wrapper.text()).toContain('20 linked human/retry outcomes')
    expect(wrapper.text()).toContain('40.0% matured')
    expect(wrapper.text()).toContain('6 multi-step outcome paths')
    expect(wrapper.text()).toContain('-25.0%')
  })

  it('refetches evaluation when the window changes', async () => {
    const wrapper = mount(ClassificationStats)
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '7d').trigger('click')
    await flushPromises()

    expect(api.getSecondPassEvaluation).toHaveBeenLastCalledWith(7)
  })
})
