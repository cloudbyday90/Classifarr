/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest'
import {
  getApprovedConstraintValueEligibilityControl,
  isApprovedConstraintValue,
  isApprovedConstraintValueEligibility,
} from '@/utils/policyIntentConstraintValueEligibility'

function buildProjection(overrides = {}) {
  const ratingOptions = ['G', 'PG', 'PG-13', 'R', 'NC-17']
    .map(value => ({ value, label: value, description: null }))

  return {
    version: 'policy.constraint_value_eligibility.v1',
    statusId: 'ready',
    libraryMediaTypeFamilyId: 'movie',
    authority: {
      displayProjection: true,
      serverOwnedAllowlist: true,
      policyPersistence: false,
      routingExecution: false,
      runtimeDecision: false,
      clientMayAddValues: false,
    },
    controls: [
      {
        controlId: 'hard_limit',
        valueKindId: 'certification',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: ratingOptions,
      },
      {
        controlId: 'avoid',
        valueKindId: 'certification',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: ratingOptions,
      },
      {
        controlId: 'review_warning',
        valueKindId: 'review_trigger',
        selectionModeId: 'single',
        allowsFreeText: false,
        options: [{
          value: 'evidence_missing',
          label: 'Evidence is missing',
          description: 'Ask when evidence is not sufficient for automation.',
        }],
      },
    ],
    rawPayloadExposed: false,
    ...overrides,
  }
}

describe('policyIntentConstraintValueEligibility', () => {
  it('accepts a bounded server-owned projection and resolves only approved values', () => {
    const projection = buildProjection()

    expect(isApprovedConstraintValueEligibility(projection)).toBe(true)
    expect(getApprovedConstraintValueEligibilityControl(projection, 'avoid')?.options)
      .toHaveLength(5)
    expect(isApprovedConstraintValue({
      projection,
      controlId: 'hard_limit',
      value: 'PG-13',
    })).toBe(true)
    expect(isApprovedConstraintValue({
      projection,
      controlId: 'hard_limit',
      value: 'TV-14',
    })).toBe(false)
  })

  it('fails closed when the projection exposes free text, unexpected fields, or duplicate values', () => {
    const freeText = buildProjection()
    freeText.controls[0].allowsFreeText = true
    expect(isApprovedConstraintValueEligibility(freeText)).toBe(false)

    const injected = buildProjection({ policyId: 4 })
    expect(isApprovedConstraintValueEligibility(injected)).toBe(false)

    const duplicate = buildProjection()
    duplicate.controls[1].options.push({ value: 'R', label: 'R', description: null })
    expect(isApprovedConstraintValueEligibility(duplicate)).toBe(false)
  })

  it('allows an explicitly unsupported library type only with no controls', () => {
    const projection = buildProjection({
      statusId: 'unsupported_library_media_type',
      libraryMediaTypeFamilyId: null,
      controls: [],
    })

    expect(isApprovedConstraintValueEligibility(projection)).toBe(true)
    expect(getApprovedConstraintValueEligibilityControl(projection, 'avoid')).toBeNull()
  })
})
