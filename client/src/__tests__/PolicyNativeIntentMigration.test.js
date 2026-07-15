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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PolicyNativeIntentMigration from '@/views/PolicyNativeIntentMigration.vue'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getNativeIntentConversionPreview: vi.fn(),
    applyNativeIntentConversion: vi.fn(),
  },
}))

vi.mock('@/api', () => ({ default: apiMock }))

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
    }
  }
})

const candidatePreview = {
  candidateReport: {
    summary: {
      totalPolicyCount: 2,
      convertibleCount: 1,
      reviewRequiredCount: 1,
    },
    candidates: [
      {
        policyId: 41,
        policyName: 'Family Movies',
        libraryName: 'Movies',
        canConvert: true,
        automationReadiness: { statusId: 'needs_routing_target' },
        reasons: [{ reasonId: 'ready_to_convert', message: 'Ready for native conversion.' }],
      },
      {
        policyId: 42,
        policyName: 'Review Needed',
        libraryName: 'Movies',
        canConvert: false,
        automationReadiness: { statusId: 'ready_for_automation' },
        reasons: [{ reasonId: 'operator_review_required', message: 'Review legacy rule shape.' }],
      },
    ],
  },
}

function mountView() {
  return mount(PolicyNativeIntentMigration, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('PolicyNativeIntentMigration.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getNativeIntentConversionPreview.mockResolvedValue(candidatePreview)
  })

  it('shows server-owned conversion and separate automation readiness', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Native intent conversion')
    expect(wrapper.text()).toContain('Ready to convert')
    expect(wrapper.text()).toContain('Routing target needed')
    expect(wrapper.text()).toContain('Needs review')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(wrapper.findAll('input[type="checkbox"]')[1].attributes('disabled')).toBeDefined()
  })

  it('opens confirmation only after selecting a ready policy', async () => {
    const wrapper = mountView()
    await flushPromises()

    const reviewButton = wrapper.findAll('button')
      .find(button => button.text().includes('Review conversion'))
    expect(reviewButton).toBeDefined()
    expect(reviewButton.attributes('disabled')).toBeDefined()

    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true)

    expect(reviewButton.attributes('disabled')).toBeUndefined()
    await reviewButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Confirm native intent conversion')
    expect(wrapper.text()).toContain('Family Movies, Movies')
  })

  it('shows the bounded runtime verification outcome after a successful conversion', async () => {
    apiMock.applyNativeIntentConversion.mockResolvedValue({
      data: {
        summary: {
          appliedPolicyCount: 1,
          alreadyConvertedCount: 0,
        },
        runtimeObservation: {
          statusId: 'verified',
          summary: {
            observedPolicyCount: 1,
            nativeReadVerifiedCount: 1,
            rollbackAvailableCount: 1,
          },
        },
      },
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true)
    const reviewButton = wrapper.findAll('button')
      .find(button => button.text().includes('Review conversion'))
    await reviewButton.trigger('click')
    await flushPromises()

    await wrapper.find('input[id="native-intent-conversion-confirmation"]')
      .setValue('CONVERT_NATIVE_INTENT')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Post-conversion runtime verification')
    expect(wrapper.text()).toContain('Native reads verified')
    expect(wrapper.text()).toContain('Verified')
  })
})
