/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DecisionPathTelemetry from '@/components/command-center/DecisionPathTelemetry.vue'

describe('DecisionPathTelemetry', () => {
  it('renders only the fixed aggregate contract', () => {
    const wrapper = mount(DecisionPathTelemetry, {
      props: {
        telemetry: {
          version: 'classification.decision_path_telemetry.v1',
          window: { hours: 24 },
          counts: {
            deterministicPolicy: 7,
            aiClassificationAttempt: 4,
            aiUnavailableRetry: 2,
            strictVerificationAbstention: 1,
          },
          title: 'Private title',
          model: 'private-model',
          prompt: 'private-prompt',
          response: 'private-response',
        },
      },
    })

    expect(wrapper.text()).toContain('Recent decision paths')
    expect(wrapper.text()).toContain('AI was not needed')
    expect(wrapper.text()).toContain('AI classification attempted')
    expect(wrapper.text()).toContain('AI unavailable — retry queued')
    expect(wrapper.text()).toContain('Strict verification abstained')
    expect(wrapper.text()).toContain('Last 24 hours')
    expect(wrapper.text()).not.toContain('Private title')
    expect(wrapper.text()).not.toContain('private-model')
    expect(wrapper.text()).not.toContain('private-prompt')
    expect(wrapper.text()).not.toContain('private-response')
  })

  it('does not render an unknown or malformed contract', () => {
    const wrapper = mount(DecisionPathTelemetry, {
      props: {
        telemetry: {
          version: 'untrusted-version',
          window: { hours: 24 },
          counts: { deterministicPolicy: 1 },
        },
      },
    })

    expect(wrapper.find('[aria-labelledby="decision-path-telemetry-heading"]').exists()).toBe(false)
  })
})
