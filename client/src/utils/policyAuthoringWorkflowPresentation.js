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

export const POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION =
  'policy.authoring_workflow_presentation.v1'

export const POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
})

const WORKFLOW_READ_VERSION = 'policy.operator_workflow_read.v4'
const REVISION_PATTERN = /^[A-Za-z0-9_-]{43}$/
const MAX_LABEL_LENGTH = 240
const NEXT_ACTION_KINDS = new Set(['owner_action', 'automated_guidance'])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function normalizeString(value, maximumLength = MAX_LABEL_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const normalized = String(value)
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)

  return normalized || null
}

function normalizeNonNegativeInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : null
}

function hasOnlyKeys(value, expectedKeys) {
  const source = asObject(value)
  if (!source) return false

  const keys = Object.keys(source).sort()
  const allowedKeys = [...expectedKeys].sort()
  return keys.length === allowedKeys.length && keys.every((key, index) => key === allowedKeys[index])
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value

  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

function buildUnavailablePresentation(libraryId = null) {
  return deepFreeze({
    version: POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
    statusId: POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS.UNAVAILABLE,
    revision: null,
    library: {
      id: normalizePositiveInteger(libraryId),
      name: null,
      mediaType: null,
    },
    destinationProposal: null,
    nextAction: null,
    adjustment: {
      available: false,
      statusId: 'unavailable',
    },
    recovery: {
      statusId: null,
      automated: false,
      message: null,
    },
  })
}

function hasDisplayOnlyAuthority(authority) {
  return hasOnlyKeys(authority, [
    'displayProjection',
    'automationDecision',
    'policyPersistence',
    'routingExecution',
  ]) && authority.displayProjection === true &&
    authority.automationDecision === false &&
    authority.policyPersistence === false &&
    authority.routingExecution === false
}

function normalizeNextAction(value) {
  if (value === null) return null

  if (!hasOnlyKeys(value, ['kind', 'ownerId', 'sectionId', 'actionId', 'message'])) {
    return null
  }

  const kind = normalizeString(value.kind, 80)
  const ownerId = normalizeString(value.ownerId, 120)
  const message = normalizeString(value.message)
  const sectionId = normalizeString(value.sectionId, 120)
  const actionId = normalizeString(value.actionId, 120)
  if (!NEXT_ACTION_KINDS.has(kind) || !ownerId || !message) return null
  if (kind === 'owner_action' && !actionId) return null
  if (kind === 'automated_guidance' && actionId !== null) return null

  return { kind, ownerId, sectionId, actionId, message }
}

function normalizeDestinationProposal(value) {
  if (!hasOnlyKeys(value, [
    'statusId',
    'title',
    'summary',
    'available',
    'requiresExplicitAdmission',
    'observedContext',
  ])) {
    return null
  }

  if (!hasOnlyKeys(value.observedContext, [
    'available',
    'current',
    'itemCount',
    'suggestionCount',
  ])) {
    return null
  }

  const statusId = normalizeString(value.statusId, 80)
  const title = normalizeString(value.title)
  const summary = normalizeString(value.summary)
  const itemCount = value.observedContext.itemCount === null
    ? null
    : normalizeNonNegativeInteger(value.observedContext.itemCount)
  const suggestionCount = normalizeNonNegativeInteger(value.observedContext.suggestionCount)
  if (!statusId || !title || !summary ||
    (itemCount === null && value.observedContext.itemCount !== null) ||
    suggestionCount === null || typeof value.available !== 'boolean' ||
    value.requiresExplicitAdmission !== true ||
    typeof value.observedContext.available !== 'boolean' ||
    typeof value.observedContext.current !== 'boolean') {
    return null
  }

  if (value.available !== (value.observedContext.current && suggestionCount > 0)) return null

  return {
    statusId,
    title,
    summary,
    available: value.available,
    requiresExplicitAdmission: true,
    observedContext: {
      available: value.observedContext.available,
      current: value.observedContext.current,
      itemCount,
      suggestionCount,
    },
  }
}

function normalizeAdjustment(value) {
  if (!hasOnlyKeys(value, ['available', 'statusId'])) return null

  const statusId = normalizeString(value.statusId, 80)
  if (typeof value.available !== 'boolean' || !statusId) return null
  if (statusId !== (value.available ? 'available' : 'unavailable')) return null

  return { available: value.available, statusId }
}

function normalizeRecovery(value, nextAction) {
  if (!hasOnlyKeys(value, ['statusId', 'automated', 'message'])) return null

  const statusId = normalizeString(value.statusId, 80)
  const message = value.message === null ? null : normalizeString(value.message)
  const automated = nextAction?.kind === 'automated_guidance'
  if (!statusId || typeof value.automated !== 'boolean' || value.automated !== automated) return null
  if (automated && message !== nextAction.message) return null
  if (!automated && message !== null) return null

  return { statusId, automated, message }
}

export function adaptPolicyAuthoringWorkflowPresentation({
  workflowRead,
  expectedLibraryId,
} = {}) {
  const libraryId = normalizePositiveInteger(expectedLibraryId)
  const source = asObject(workflowRead)
  const sourceLibrary = asObject(source?.library)
  const presentation = asObject(source?.presentation)

  if (
    libraryId === null ||
    source?.version !== WORKFLOW_READ_VERSION ||
    source?.rawPayloadExposed !== false ||
    !hasOnlyKeys(sourceLibrary, ['id', 'name', 'mediaType']) ||
    normalizePositiveInteger(sourceLibrary.id) !== libraryId ||
    !normalizeString(source.statusId, 80) ||
    !hasDisplayOnlyAuthority(source.authority) ||
    !presentation ||
    !hasOnlyKeys(presentation, [
      'version',
      'revision',
      'library',
      'destinationProposal',
      'nextAction',
      'adjustment',
      'recovery',
      'authority',
      'rawPayloadExposed',
    ]) ||
    presentation.version !== POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION ||
    !REVISION_PATTERN.test(presentation.revision || '') ||
    presentation.rawPayloadExposed !== false ||
    !hasDisplayOnlyAuthority(presentation.authority) ||
    !hasOnlyKeys(presentation.library, ['id', 'name', 'mediaType']) ||
    normalizePositiveInteger(presentation.library.id) !== libraryId
  ) {
    return {
      ok: false,
      presentation: buildUnavailablePresentation(libraryId),
    }
  }

  const libraryName = normalizeString(presentation.library.name, 160)
  const mediaType = presentation.library.mediaType === null
    ? null
    : normalizeString(presentation.library.mediaType, 80)
  const sourceLibraryName = normalizeString(sourceLibrary.name, 160)
  const sourceMediaType = sourceLibrary.mediaType === null
    ? null
    : normalizeString(sourceLibrary.mediaType, 80)
  const sourceStatusId = normalizeString(source.statusId, 80)
  const nextAction = normalizeNextAction(presentation.nextAction)
  const destinationProposal = normalizeDestinationProposal(presentation.destinationProposal)
  const adjustment = normalizeAdjustment(presentation.adjustment)
  const recovery = normalizeRecovery(presentation.recovery, nextAction)
  if (
    !libraryName ||
    libraryName !== sourceLibraryName ||
    mediaType !== sourceMediaType ||
    !nextAction ||
    !destinationProposal ||
    destinationProposal.statusId !== sourceStatusId ||
    !adjustment ||
    !recovery ||
    recovery.statusId !== sourceStatusId
  ) {
    return {
      ok: false,
      presentation: buildUnavailablePresentation(libraryId),
    }
  }

  return {
    ok: true,
    presentation: deepFreeze({
      version: POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
      statusId: POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS.READY,
      revision: presentation.revision,
      library: {
        id: libraryId,
        name: libraryName,
        mediaType,
      },
      destinationProposal,
      nextAction,
      adjustment,
      recovery,
    }),
  }
}
