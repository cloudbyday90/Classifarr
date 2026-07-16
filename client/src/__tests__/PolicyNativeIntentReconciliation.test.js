/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PolicyNativeIntentReconciliation from '@/views/PolicyNativeIntentReconciliation.vue'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getNativeIntentReconciliationStatus: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

const reconciliationStatus = {
  statusId: 'attention_required',
  nextScheduledAttemptAt: '2026-07-16T02:10:00.000Z',
  control: {
    automationEnabled: true,
    circuitState: 'closed',
  },
  inventory: {
    unresolvedCount: 3,
  },
  latestRun: {
    completedAt: '2026-07-16T02:00:00.000Z',
    reasonId: 'eligible_candidates_converted',
    counts: {
      convertedCount: 2,
      deferredCount: 1,
      blockedCount: 1,
    },
  },
  blockerReasonGroups: [
    {
      outcomeState: 'requires_maintenance',
      reasonId: 'rollback_hold_active',
      policyCount: 3,
    },
  ],
}

function mountView() {
  return mount(PolicyNativeIntentReconciliation, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('PolicyNativeIntentReconciliation.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getNativeIntentReconciliationStatus.mockResolvedValue(reconciliationStatus)
  })

  it('shows automatic scheduler status and bounded blocker evidence without conversion controls', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Native intent reconciliation')
    expect(wrapper.text()).toContain('Automation needs attention')
    expect(wrapper.text()).toContain('Current blocker groups')
    expect(wrapper.text()).toContain('Rollback Hold Active')
    expect(wrapper.text()).toContain('Automatic reconciliation remains the only normal conversion path')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Confirm native intent conversion')
    expect(wrapper.text()).not.toContain('Review conversion')
  })

  it('refreshes only the read-only status contract', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(apiMock.getNativeIntentReconciliationStatus).toHaveBeenCalledTimes(2)
  })

  it('reports unavailable control state without treating it as a paused scheduler', async () => {
    apiMock.getNativeIntentReconciliationStatus.mockResolvedValue({
      ...reconciliationStatus,
      statusId: 'control_unavailable',
      control: {
        available: false,
        automationEnabled: true,
        circuitState: 'closed',
      },
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Control unavailable')
    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.text()).not.toContain('AutomationEnabled')
  })
})
