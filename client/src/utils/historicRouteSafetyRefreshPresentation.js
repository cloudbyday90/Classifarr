/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const IN_FLIGHT_RECONCILIATION_STATUS_IDS = new Set([
  'execution_incomplete',
  'queue_pending',
  'queue_processing',
  'runtime_pending',
  'runtime_pending_retry',
  'runtime_reclassifying',
])

const STATUS_PRESENTATIONS = Object.freeze({
  execution_incomplete: {
    label: 'Execution still being finalized',
    description: 'Classifarr has not finalized the controlled retry receipt yet.',
    tone: 'warning',
  },
  not_queued: {
    label: 'Not queued',
    description: 'The current row was not eligible for this retry.',
    tone: 'neutral',
  },
  retry_failed: {
    label: 'Retry failed',
    description: 'The controlled retry did not complete for this record.',
    tone: 'error',
  },
  queue_pending: {
    label: 'Queued',
    description: 'The retry is waiting for a worker.',
    tone: 'info',
  },
  queue_processing: {
    label: 'Processing',
    description: 'The retry is being evaluated against the current runtime state.',
    tone: 'info',
  },
  queue_failed: {
    label: 'Queue failed',
    description: 'The queued retry did not complete.',
    tone: 'error',
  },
  queue_cancelled: {
    label: 'Queue cancelled',
    description: 'The queued retry was cancelled before completion.',
    tone: 'warning',
  },
  runtime_awaiting_decision: {
    label: 'Needs a decision',
    description: 'Current policy evaluation requires an operator decision.',
    tone: 'warning',
  },
  runtime_pending: {
    label: 'Runtime pending',
    description: 'The current classification remains pending.',
    tone: 'info',
  },
  runtime_pending_retry: {
    label: 'Runtime retry pending',
    description: 'The current classification is waiting for a follow-up retry.',
    tone: 'info',
  },
  runtime_reclassifying: {
    label: 'Reclassifying',
    description: 'Classifarr is producing the current runtime outcome.',
    tone: 'info',
  },
  runtime_completed: {
    label: 'Completed',
    description: 'The current runtime classification completed.',
    tone: 'success',
  },
  runtime_corrected: {
    label: 'Corrected',
    description: 'The current runtime classification was corrected.',
    tone: 'success',
  },
  runtime_verified: {
    label: 'Verified',
    description: 'The current runtime classification was verified.',
    tone: 'success',
  },
  runtime_routed: {
    label: 'Routed',
    description: 'The current runtime classification reached a route outcome.',
    tone: 'success',
  },
  runtime_failed: {
    label: 'Runtime failed',
    description: 'The current runtime classification failed.',
    tone: 'error',
  },
  current_runtime_not_observed: {
    label: 'No current outcome observed',
    description: 'The retry completed, but no retained current runtime outcome is available.',
    tone: 'warning',
  },
  source_record_unavailable: {
    label: 'Source record unavailable',
    description: 'The historical source record is no longer retained.',
    tone: 'warning',
  },
  runtime_state_unknown: {
    label: 'Runtime state unavailable',
    description: 'Classifarr could not recognize the current runtime state.',
    tone: 'warning',
  },
})

const EXECUTION_PRESENTATIONS = Object.freeze({
  requested: { label: 'Requested', tone: 'warning' },
  queued: { label: 'Queued', tone: 'info' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'error' },
})

const UNKNOWN_STATUS_PRESENTATION = Object.freeze({
  label: 'Status unavailable',
  description: 'Classifarr returned an unrecognized protected status.',
  tone: 'warning',
})

export function historicRouteSafetyRefreshStatusPresentation(statusId) {
  return STATUS_PRESENTATIONS[statusId] || UNKNOWN_STATUS_PRESENTATION
}

export function historicRouteSafetyRefreshExecutionPresentation(statusId) {
  return EXECUTION_PRESENTATIONS[statusId] || {
    label: 'Unavailable',
    tone: 'warning',
  }
}

export function isHistoricRouteSafetyRefreshReceiptInFlight(receipt = {}) {
  if (receipt?.receipt?.executionStatusId !== 'finalized') return true

  return Array.isArray(receipt?.records) && receipt.records.some(record => (
    IN_FLIGHT_RECONCILIATION_STATUS_IDS.has(record?.reconciliationStatusId)
  ))
}

export function formatHistoricRouteSafetyRefreshTimestamp(value) {
  if (!value) return 'Not available'

  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? 'Not available' : timestamp.toLocaleString()
}
