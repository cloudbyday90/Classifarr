/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const CONTROL_VERSION = 'policy.candidate_correction_representative_review_corpus_control.v1'
const PURPOSE_ID = 'representative_historical_correction_review'
const REQUIRED_SAFEGUARD_IDS = Object.freeze([
  'authorization',
  'redaction',
  'retention',
  'operator_audit',
])
const REVIEW_FRAME = Object.freeze({
  periodCount: 2,
  completedUtcDaysPerPeriod: 28,
  strata: Object.freeze([
    'score_margin_band',
    'operator_selection_outcome',
  ]),
})
const STATUS_IDS = Object.freeze({
  CONFIGURATION_REQUIRED: 'configuration_required',
  CONFIGURATION_ACKNOWLEDGED: 'configuration_acknowledged',
})
const REVISION_PATTERN = /^[a-f0-9]{64}$/u

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function hasExactArray(value, expected) {
  return Array.isArray(value) && value.length === expected.length &&
    value.every((item, index) => item === expected[index])
}

function hasExpectedReviewFrame(value) {
  const source = asPlainObject(value)
  return source?.periodCount === REVIEW_FRAME.periodCount &&
    source.completedUtcDaysPerPeriod === REVIEW_FRAME.completedUtcDaysPerPeriod &&
    hasExactArray(source.strata, REVIEW_FRAME.strata)
}

function normalizeConfiguration(value) {
  const source = asPlainObject(value)
  const retentionDays = Number(source?.reviewRecordRetentionDays)
  const acknowledgedAt = typeof source?.acknowledgedAt === 'string' &&
    Number.isFinite(Date.parse(source.acknowledgedAt))
    ? new Date(source.acknowledgedAt).toISOString()
    : null

  if (!source || !REVISION_PATTERN.test(source.revision || '') ||
      !Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 90 ||
      !acknowledgedAt) {
    return null
  }

  return Object.freeze({
    revision: source.revision,
    reviewRecordRetentionDays: retentionDays,
    acknowledgedAt,
  })
}

export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControl(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== CONTROL_VERSION || source.historicalRecordAccess !== false ||
      source.purposeId !== PURPOSE_ID || !hasExpectedReviewFrame(source.reviewFrame) ||
      !hasExactArray(source.requiredSafeguardIds, REQUIRED_SAFEGUARD_IDS) ||
      source.reviewProjectionStatusId !== 'not_implemented' ||
      source.auditTrail?.appendOnly !== true || source.auditTrail?.recentEventsAvailable !== true) {
    return null
  }

  const statusId = source.statusId
  const configuration = source.configuration === null ? null : normalizeConfiguration(source.configuration)
  const configurationRequired = statusId === STATUS_IDS.CONFIGURATION_REQUIRED && configuration === null
  const configurationAcknowledged = statusId === STATUS_IDS.CONFIGURATION_ACKNOWLEDGED && configuration !== null
  if (!configurationRequired && !configurationAcknowledged) return null

  return Object.freeze({
    statusId,
    configuration,
    historicalRecordAccess: false,
  })
}

export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusAuditEvents(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== CONTROL_VERSION || !Array.isArray(source.events)) return null

  const events = source.events.map(event => {
    const candidate = asPlainObject(event)
    const eventId = Number(candidate?.eventId)
    const actorId = Number(candidate?.actorId)
    const retentionDays = Number(candidate?.reviewRecordRetentionDays)
    const occurredAt = typeof candidate?.occurredAt === 'string' && Number.isFinite(Date.parse(candidate.occurredAt))
      ? new Date(candidate.occurredAt).toISOString()
      : null
    const previousRevision = candidate?.previousConfigurationRevision === null
      ? null
      : REVISION_PATTERN.test(candidate?.previousConfigurationRevision || '')
        ? candidate.previousConfigurationRevision
        : undefined

    if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(actorId) || actorId <= 0 ||
        candidate?.actionId !== 'configuration_acknowledged' ||
        !REVISION_PATTERN.test(candidate?.configurationRevision || '') ||
        previousRevision === undefined || !Number.isInteger(retentionDays) ||
        retentionDays < 7 || retentionDays > 90 || !occurredAt) {
      return null
    }

    return Object.freeze({
      eventId,
      actorId,
      actionId: candidate.actionId,
      configurationRevision: candidate.configurationRevision,
      previousConfigurationRevision: previousRevision,
      reviewRecordRetentionDays: retentionDays,
      occurredAt,
    })
  })

  return events.every(Boolean) ? Object.freeze(events) : null
}

export function getPolicyCandidateCorrectionRepresentativeReviewCorpusControlPresentation(statusId) {
  if (statusId === STATUS_IDS.CONFIGURATION_ACKNOWLEDGED) {
    return Object.freeze({
      heading: 'Historic review corpus safeguards acknowledged',
      message: 'The future review contract is documented. Historic records remain unavailable until a separate redacted projection is implemented and authorized.',
      statusClass: 'text-green-400',
    })
  }

  if (statusId === STATUS_IDS.CONFIGURATION_REQUIRED) {
    return Object.freeze({
      heading: 'Historic review corpus safeguards need acknowledgement',
      message: 'No historic records are available. An administrator must acknowledge the fixed purpose, safeguards, and future retention limit before a later corpus implementation can proceed.',
      statusClass: 'text-amber-300',
    })
  }

  return null
}

export {
  CONTROL_VERSION as POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_VERSION,
  REQUIRED_SAFEGUARD_IDS as POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS,
  STATUS_IDS as POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CONTROL_STATUS_IDS,
}
