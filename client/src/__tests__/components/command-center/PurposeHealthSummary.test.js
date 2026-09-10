/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PurposeHealthSummary from '@/components/command-center/PurposeHealthSummary.vue'
import { ROUTER_LINK_SIMPLE_STUB } from '../../helpers/vueTestUtils'

const health = {
  version: 'policy_purpose_health.v1',
  statusId: 'attention_required',
  summary: {
    reviewedLibraryCount: 4,
    declaredPurposeLibraryCount: 2,
    missingPurposeLibraryCount: 1,
    competingDestinationLibraryCount: 1,
    profileDerivedPurposeLibraryCount: 1,
    unverifiedPurposeLibraryCount: 0,
    needsAttentionLibraryCount: 2,
    reviewWindowTruncated: false,
  },
}

describe('PurposeHealthSummary', () => {
  it('shows plain-language exceptions and leaves detailed review progressively disclosed', () => {
    const wrapper = mount(PurposeHealthSummary, {
      props: { health },
      global: { stubs: { RouterLink: ROUTER_LINK_SIMPLE_STUB } },
    })

    expect(wrapper.text()).toContain('2 of 4 assessed libraries have a declared purpose.')
    expect(wrapper.text()).toContain('1 lack a declared purpose.')
    expect(wrapper.text()).toContain('1 have a competing destination.')
    expect(wrapper.text()).toContain('1 still rely on observed profile suggestions.')
    expect(wrapper.text()).toContain('Review exceptions')
    expect(wrapper.text()).toContain('does not change routing, invoke AI/RAG, or change learning')
    expect(wrapper.find('[aria-live]').exists()).toBe(false)
  })

  it('does not render an empty administrator-only summary for ordinary operators', () => {
    const wrapper = mount(PurposeHealthSummary)

    expect(wrapper.find('#library-purpose-health').exists()).toBe(false)
  })
})
