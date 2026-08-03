/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

export const POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION =
  'policy.authoring_workflow_presentation.v1';

export const POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS = Object.freeze({
  INVALID_PROJECTION: 'invalid_projection',
  UNSAFE_AUTHORITY: 'unsafe_authority',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
});

const MAX_LABEL_LENGTH = 240;
const NEXT_ACTION_KINDS = new Set(['owner_action', 'automated_guidance']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value, maximumLength = MAX_LABEL_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);

  return normalized || null;
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : null;
}

function buildRevision(value) {
  return createHash('sha256')
    .update(stableSerialize(value), 'utf8')
    .digest('base64url');
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  return `{${Object.keys(value).sort().map(key => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(',')}}`;
}

function buildAuthority() {
  return {
    displayProjection: true,
    automationDecision: false,
    policyPersistence: false,
    routingExecution: false,
  };
}

function buildNextAction(readinessPresentation = {}) {
  const primary = asObject(readinessPresentation).primary;
  if (!primary || typeof primary !== 'object') return null;

  const kind = normalizeString(primary.kind, 80);
  const ownerId = normalizeString(primary.ownerId, 120);
  const message = normalizeString(primary.message);
  const actionId = normalizeString(primary.actionId, 120);
  if (!NEXT_ACTION_KINDS.has(kind) || !ownerId || !message) return null;
  if (kind === 'owner_action' && !actionId) return null;
  if (kind === 'automated_guidance' && actionId !== null) return null;

  return {
    kind,
    ownerId,
    sectionId: normalizeString(primary.sectionId, 120),
    actionId,
    message,
  };
}

function buildDestinationProposal({ statusId, workflow, observedProfile } = {}) {
  const observed = asObject(observedProfile);
  const current = observed.current === true;
  const suggestionCount = normalizeNonNegativeInteger(observed.suggestionCount) ?? 0;

  return {
    statusId: normalizeString(statusId, 80),
    title: normalizeString(workflow.title) || 'Destination setup',
    summary: normalizeString(workflow.summary) || 'Use the connected library as the destination context.',
    available: current && suggestionCount > 0,
    requiresExplicitAdmission: true,
    observedContext: {
      available: observed.available === true,
      current,
      itemCount: normalizeNonNegativeInteger(observed.itemCount),
      suggestionCount,
    },
  };
}

function buildAdjustmentAvailability(workflow = {}) {
  const available = asArray(workflow.sections).some(section => section?.editable === true);

  return {
    available,
    statusId: available ? 'available' : 'unavailable',
  };
}

function buildRecovery({ statusId, nextAction } = {}) {
  const automated = nextAction?.kind === 'automated_guidance';

  return {
    statusId: normalizeString(statusId, 80),
    automated,
    message: automated ? nextAction.message : null,
  };
}

export function buildPolicyAuthoringWorkflowPresentation({
  library = {},
  statusId,
  observedProfile = {},
  workflow = {},
  readinessPresentation = {},
} = {}) {
  const normalizedLibrary = asObject(library);
  const normalizedWorkflow = asObject(workflow);
  const nextAction = buildNextAction(readinessPresentation);
  const destinationProposal = buildDestinationProposal({
    statusId,
    workflow: normalizedWorkflow,
    observedProfile,
  });
  const adjustment = buildAdjustmentAvailability(normalizedWorkflow);
  const recovery = buildRecovery({ statusId, nextAction });
  const projection = {
    version: POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
    library: {
      id: normalizePositiveInteger(normalizedLibrary.id),
      name: normalizeString(normalizedLibrary.name, 160),
      mediaType: normalizeString(normalizedLibrary.mediaType ?? normalizedLibrary.media_type, 80),
    },
    destinationProposal,
    nextAction,
    adjustment,
    recovery,
    authority: buildAuthority(),
    rawPayloadExposed: false,
  };

  return {
    ...projection,
    revision: buildRevision(projection),
  };
}

export function buildPolicyAuthoringWorkflowPresentationAudit({
  presentation,
  library,
  statusId,
  observedProfile,
  workflow,
  readinessPresentation,
} = {}) {
  const expected = buildPolicyAuthoringWorkflowPresentation({
    library,
    statusId,
    observedProfile,
    workflow,
    readinessPresentation,
  });
  const source = asObject(presentation);
  const issues = [];

  if (stableSerialize(source) !== stableSerialize(expected)) {
    issues.push({
      riskId: POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS.INVALID_PROJECTION,
      message: 'Policy authoring presentation must match the current server-owned workflow projection.',
    });
  }

  const authority = asObject(source.authority);
  if (
    authority.displayProjection !== true ||
    authority.automationDecision !== false ||
    authority.policyPersistence !== false ||
    authority.routingExecution !== false
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS.UNSAFE_AUTHORITY,
      message: 'Policy authoring presentation must remain display-only.',
    });
  }

  if (source.rawPayloadExposed !== false) {
    issues.push({
      riskId: POLICY_AUTHORING_WORKFLOW_PRESENTATION_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Policy authoring presentation must not expose raw workflow data.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}
