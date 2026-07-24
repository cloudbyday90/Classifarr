/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION =
  'policy.constraint_value_eligibility.v1'

const READY_STATUS_ID = 'ready'
const UNSUPPORTED_MEDIA_TYPE_STATUS_ID = 'unsupported_library_media_type'
const EXPECTED_CONTROL_IDS = new Set([
  'hard_limit',
  'avoid',
  'review_warning',
])
const EXPECTED_VALUE_KIND_BY_CONTROL_ID = Object.freeze({
  hard_limit: 'certification',
  avoid: 'certification',
  review_warning: 'review_trigger',
})

const MODEL_PROPERTY_IDS = new Set([
  'version',
  'statusId',
  'libraryMediaTypeFamilyId',
  'authority',
  'controls',
  'rawPayloadExposed',
])
const AUTHORITY_PROPERTY_IDS = new Set([
  'displayProjection',
  'serverOwnedAllowlist',
  'policyPersistence',
  'routingExecution',
  'runtimeDecision',
  'clientMayAddValues',
])
const CONTROL_PROPERTY_IDS = new Set([
  'controlId',
  'valueKindId',
  'selectionModeId',
  'allowsFreeText',
  'options',
])
const OPTION_PROPERTY_IDS = new Set([
  'value',
  'label',
  'description',
])

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyProperties(value, allowedProperties) {
  return isPlainObject(value) && Object.keys(value).every(property => allowedProperties.has(property))
}

function removeControlCharacters(value) {
  return Array.from(value).filter((character) => {
    const code = character.charCodeAt(0)
    return code > 31 && code !== 127
  }).join('')
}

function normalizeText(value, maximumLength = 160) {
  if (typeof value !== 'string') return ''

  const normalized = value
    .normalize('NFKC')
  const displayValue = removeControlCharacters(normalized)
    .replace(/\s+/g, ' ')
    .trim()

  return displayValue && displayValue.length <= maximumLength ? displayValue : ''
}

function hasApprovedAuthority(authority) {
  return hasOnlyProperties(authority, AUTHORITY_PROPERTY_IDS) &&
    authority.displayProjection === true &&
    authority.serverOwnedAllowlist === true &&
    authority.policyPersistence === false &&
    authority.routingExecution === false &&
    authority.runtimeDecision === false &&
    authority.clientMayAddValues === false
}

function hasApprovedOption(option) {
  if (!hasOnlyProperties(option, OPTION_PROPERTY_IDS)) return false

  const value = normalizeText(option.value, 120)
  const label = normalizeText(option.label, 160)
  const description = option.description === null
    ? null
    : normalizeText(option.description, 320)

  return Boolean(value && label) &&
    value === option.value &&
    label === option.label &&
    (option.description === null || description === option.description)
}

function hasApprovedControl(control, seenControlIds) {
  if (!hasOnlyProperties(control, CONTROL_PROPERTY_IDS)) return false

  const controlId = normalizeText(control.controlId, 80)
  const expectedValueKindId = EXPECTED_VALUE_KIND_BY_CONTROL_ID[controlId]
  const options = asArray(control.options)
  const optionValues = new Set()

  if (
    !controlId ||
    seenControlIds.has(controlId) ||
    !EXPECTED_CONTROL_IDS.has(controlId) ||
    control.valueKindId !== expectedValueKindId ||
    control.selectionModeId !== 'single' ||
    control.allowsFreeText !== false ||
    options.length === 0 ||
    options.length > 20
  ) {
    return false
  }

  const optionsApproved = options.every((option) => {
    if (!hasApprovedOption(option) || optionValues.has(option.value)) return false

    optionValues.add(option.value)
    return true
  })
  if (!optionsApproved) return false

  seenControlIds.add(controlId)
  return true
}

export function isApprovedConstraintValueEligibility(projection = {}) {
  if (
    !hasOnlyProperties(projection, MODEL_PROPERTY_IDS) ||
    projection.version !== POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION ||
    !hasApprovedAuthority(projection.authority) ||
    projection.rawPayloadExposed !== false
  ) {
    return false
  }

  const controls = asArray(projection.controls)
  if (projection.statusId === UNSUPPORTED_MEDIA_TYPE_STATUS_ID) {
    return projection.libraryMediaTypeFamilyId === null && controls.length === 0
  }

  if (
    projection.statusId !== READY_STATUS_ID ||
    !['movie', 'television'].includes(projection.libraryMediaTypeFamilyId) ||
    controls.length !== EXPECTED_CONTROL_IDS.size
  ) {
    return false
  }

  const seenControlIds = new Set()
  return controls.every(control => hasApprovedControl(control, seenControlIds)) &&
    seenControlIds.size === EXPECTED_CONTROL_IDS.size
}

export function getApprovedConstraintValueEligibilityControl(projection, controlId) {
  if (!isApprovedConstraintValueEligibility(projection) || projection.statusId !== READY_STATUS_ID) {
    return null
  }

  return projection.controls.find(control => control.controlId === controlId) || null
}

export function isApprovedConstraintValue({ projection, controlId, value } = {}) {
  const control = getApprovedConstraintValueEligibilityControl(projection, controlId)
  const normalizedValue = normalizeText(value, 120)

  return Boolean(control && normalizedValue === value &&
    control.options.some(option => option.value === normalizedValue))
}
