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
  getPolicyCandidateCorrectionRepresentativeReviewCorpusControlPresentation,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl,
} from '@/utils/policyCandidateCorrectionRepresentativeReviewCorpusControlPresentation'

const REVISION = 'a'.repeat(64)
const SAFEGUARDS = ['authorization', 'redaction', 'retention', 'operator_audit']

function control(overrides = {}) {
  return {
    version: 'policy.candidate_correction_representative_review_corpus_control.v1',
    statusId: 'configuration_acknowledged',
    historicalRecordAccess: false,
    purposeId: 'representative_historical_correction_review',
    reviewFrame: {
      periodCount: 2,
      completedUtcDaysPerPeriod: 28,
      strata: ['score_margin_band', 'operator_selection_outcome'],
    },
    requiredSafeguardIds: SAFEGUARDS,
    reviewProjectionStatusId: 'redacted_snapshot_available',
    auditTrail: { appendOnly: true, recentEventsAvailable: true },
    configuration: {
      revision: REVISION,
      reviewRecordRetentionDays: 30,
      acknowledgedAt: '2026-08-30T13:00:00.000Z',
    },
    ...overrides,
  }
}

describe('representative review-corpus control presentation', () => {
  it('retains only the fixed no-access configuration model', () => {
    const normalized = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(control({
      historicalRecords: [{ title: 'Should never render' }],
    }))

    expect(normalized).toEqual({
      statusId: 'configuration_acknowledged',
      historicalRecordAccess: false,
      configuration: {
        revision: REVISION,
        reviewRecordRetentionDays: 30,
        acknowledgedAt: '2026-08-30T13:00:00.000Z',
      },
    })
    expect(normalized).not.toHaveProperty('historicalRecords')
  })

  it('fails closed when the response tries to grant record access or changes required safeguards', () => {
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(control({
      historicalRecordAccess: true,
    }))).toBeNull()
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(control({
      requiredSafeguardIds: [...SAFEGUARDS].reverse(),
    }))).toBeNull()
  })

  it('requires a null configuration while acknowledgement is still required', () => {
    expect(normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(control({
      statusId: 'configuration_required',
      configuration: null,
    }))).toEqual({
      statusId: 'configuration_required',
      configuration: null,
      historicalRecordAccess: false,
    })
  })

  it('normalizes only bounded audit metadata and explains the current status', () => {
    const events = normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents({
      version: 'policy.candidate_correction_representative_review_corpus_control.v1',
      events: [{
        eventId: 1,
        actionId: 'configuration_acknowledged',
        actorId: 7,
        configurationRevision: REVISION,
        previousConfigurationRevision: null,
        reviewRecordRetentionDays: 30,
        occurredAt: '2026-08-30T13:00:00.000Z',
      }],
    })

    expect(events).toEqual([expect.objectContaining({ eventId: 1, actorId: 7 })])
    expect(getPolicyCandidateCorrectionRepresentativeReviewCorpusControlPresentation(
      'configuration_acknowledged',
    )).toEqual(expect.objectContaining({
      heading: 'Automatic reviewed-corpus capture is enabled',
    }))
  })
})
