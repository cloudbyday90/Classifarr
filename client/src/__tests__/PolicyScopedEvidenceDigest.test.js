/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PolicyScopedEvidenceDigest from '@/components/policies/PolicyScopedEvidenceDigest.vue'

const digest = {
  statusId: 'available',
  policy: {
    id: 17,
    name: 'Documentaries',
    library: { id: 8, name: 'Documentaries', mediaType: 'movie' },
  },
  evaluatedAt: '2026-08-16T12:00:00.000Z',
  declaredIntent: {
    authority: { stateId: 'single_active_native_intent' },
    purposeRuleCount: 2,
    purposeSignalTypes: ['genres', 'keywords'],
  },
  observedLibraryProfile: {
    statusId: 'captured',
    sourceId: 'stored_library_profile',
    freshnessState: 'current',
    payloadRedacted: true,
  },
  admittedHistory: {
    windowDays: 90,
    admissionCount: 4,
    signalTypes: [{ signalType: 'genres', admissionCount: 4 }],
  },
  uncertaintyReasonIds: [],
}

describe('PolicyScopedEvidenceDigest', () => {
  it('presents only a selected policy’s bounded metadata and programmatic focus target', () => {
    const wrapper = mount(PolicyScopedEvidenceDigest, { props: { digest } })

    expect(wrapper.find('#policy-scoped-evidence-digest').attributes('tabindex')).toBe('-1')
    expect(wrapper.find('#policy-scoped-evidence-digest').attributes('aria-labelledby'))
      .toBe('policy-scoped-evidence-digest-heading')
    expect(wrapper.text()).toContain('Documentaries')
    expect(wrapper.text()).toContain('90 days')
    expect(wrapper.text()).toContain('No media titles, rule values, event identifiers, profile payload, or model output is shown.')
    expect(wrapper.text()).not.toContain('evidence_key')
  })

  it('keeps unavailable evidence non-destructive and announces the loading state', () => {
    const loading = mount(PolicyScopedEvidenceDigest, { props: { loading: true } })
    const unavailable = mount(PolicyScopedEvidenceDigest, {
      props: { digest: { statusId: 'unavailable' } },
    })

    expect(loading.get('[role="status"]').text()).toContain('Loading selected policy evidence')
    expect(unavailable.text()).toContain('no policy or route has changed')
  })
})
