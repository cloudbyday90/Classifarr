/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const STATUS_IDS = new Set([
  'no_recorded_normal_lifecycle',
  'declared_purpose_retained_for_observed_initial_establishments',
  'declared_purpose_retained_for_observed_lifecycle_receipts',
  'normal_lifecycle_receipt_verification_required',
  'normal_lifecycle_history_truncated',
  'purpose_retention_review_required',
])

function nonNegativeInteger(value) {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 ? count : null
}

function positiveInteger(value) {
  const count = Number(value)
  return Number.isInteger(count) && count > 0 ? count : null
}

function boolean(value) {
  return value === true
}

function deriveStatusId({
  normalLifecycleReceiptCount,
  nativeIntentChangeCount,
  unverifiableReceiptCount,
  retainedForEveryVerifiableReceipt,
  truncated,
}) {
  if (normalLifecycleReceiptCount === 0) return 'no_recorded_normal_lifecycle'
  if (unverifiableReceiptCount > 0) return 'normal_lifecycle_receipt_verification_required'
  if (truncated) return 'normal_lifecycle_history_truncated'
  if (retainedForEveryVerifiableReceipt && nativeIntentChangeCount === 0) {
    return 'declared_purpose_retained_for_observed_initial_establishments'
  }
  if (retainedForEveryVerifiableReceipt) {
    return 'declared_purpose_retained_for_observed_lifecycle_receipts'
  }
  return 'purpose_retention_review_required'
}

/**
 * Accepts only the fixed aggregate lifecycle receipt shape. It deliberately
 * discards unknown statuses and never lets server flags claim cohort, label,
 * semantic-selection, or routing authority in the client.
 */
export function normalizePolicyPurposeLifecycleProvenanceReceipt(value) {
  if (!value || !STATUS_IDS.has(value.statusId)) return null

  const observedReceiptCount = nonNegativeInteger(value.scope?.observedReceiptCount)
  const receiptLimit = positiveInteger(value.scope?.receiptLimit)
  const normalLifecycleReceiptCount = nonNegativeInteger(
    value.summary?.normalLifecycleReceiptCount,
  )
  const initialIntentEstablishmentCount = nonNegativeInteger(
    value.summary?.initialIntentEstablishmentCount,
  )
  const nativeIntentChangeCount = nonNegativeInteger(value.summary?.nativeIntentChangeCount)
  const verifiableReceiptCount = nonNegativeInteger(value.summary?.verifiableReceiptCount)
  const unverifiableReceiptCount = nonNegativeInteger(value.summary?.unverifiableReceiptCount)
  const retainedPurposeReceiptCount = nonNegativeInteger(
    value.summary?.retainedPurposeReceiptCount,
  )
  const profileOnlyPurposeReceiptCount = nonNegativeInteger(
    value.summary?.profileOnlyPurposeReceiptCount,
  )
  const noSpecializedPurposeReceiptCount = nonNegativeInteger(
    value.summary?.noSpecializedPurposeReceiptCount,
  )

  if (
    observedReceiptCount === null ||
    receiptLimit === null ||
    normalLifecycleReceiptCount === null ||
    initialIntentEstablishmentCount === null ||
    nativeIntentChangeCount === null ||
    verifiableReceiptCount === null ||
    unverifiableReceiptCount === null ||
    retainedPurposeReceiptCount === null ||
    profileOnlyPurposeReceiptCount === null ||
    noSpecializedPurposeReceiptCount === null ||
    observedReceiptCount !== normalLifecycleReceiptCount ||
    normalLifecycleReceiptCount !== initialIntentEstablishmentCount + nativeIntentChangeCount ||
    normalLifecycleReceiptCount !== verifiableReceiptCount + unverifiableReceiptCount ||
    verifiableReceiptCount !== retainedPurposeReceiptCount +
      profileOnlyPurposeReceiptCount + noSpecializedPurposeReceiptCount
  ) return null

  const truncated = boolean(value.scope?.truncated)
  const retainedForEveryVerifiableReceipt = verifiableReceiptCount > 0 &&
    retainedPurposeReceiptCount === verifiableReceiptCount
  const normalPolicyChangeObserved = nativeIntentChangeCount > 0
  const normalPolicyChangeRetentionVerified = !truncated &&
    normalPolicyChangeObserved &&
    unverifiableReceiptCount === 0 &&
    retainedForEveryVerifiableReceipt

  if (value.statusId !== deriveStatusId({
    normalLifecycleReceiptCount,
    nativeIntentChangeCount,
    unverifiableReceiptCount,
    retainedForEveryVerifiableReceipt,
    truncated,
  })) return null

  return {
    statusId: value.statusId,
    scope: {
      observedReceiptCount,
      receiptLimit,
      truncated,
      fullHistoryObserved: !truncated,
    },
    summary: {
      normalLifecycleReceiptCount,
      initialIntentEstablishmentCount,
      nativeIntentChangeCount,
      verifiableReceiptCount,
      unverifiableReceiptCount,
      retainedPurposeReceiptCount,
      profileOnlyPurposeReceiptCount,
      noSpecializedPurposeReceiptCount,
      retainedForEveryVerifiableReceipt,
      normalPolicyChangeObserved,
      normalPolicyChangeRetentionVerified,
    },
    rawConfigurationExposed: false,
    semanticCohortReady: false,
    semanticSelectionAffected: false,
    labelingAffected: false,
    routingAffected: false,
  }
}
