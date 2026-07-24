/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as z from 'zod';
import {
  normalizeLibraryMediaTypeFamily,
} from './policyConstraintValueEligibility.mjs';

const POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION =
  'policy.constraint_write_admission.v1';
const POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION =
  'policy.constraint_write_admission_request.v1';

const POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS = Object.freeze({
  ADMITTED: 'admitted',
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_ACTOR: 'unauthorized_actor',
  INVALID_LIBRARY_CONTEXT: 'invalid_library_context',
  UNSUPPORTED_LIBRARY_MEDIA_TYPE: 'unsupported_library_media_type',
  COMMAND_NOT_ELIGIBLE: 'command_not_eligible',
  CONTRACT_UNAVAILABLE: 'contract_unavailable',
});

const POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_ACTOR: 'unauthorized_actor',
  INVALID_LIBRARY_CONTEXT: 'invalid_library_context',
  DECISION_MODEL_UNAVAILABLE: 'decision_model_unavailable',
  VALUE_ELIGIBILITY_UNAVAILABLE: 'value_eligibility_unavailable',
  UNSUPPORTED_LIBRARY_MEDIA_TYPE: 'unsupported_library_media_type',
  COMMAND_SEMANTICS_MISMATCH: 'command_semantics_mismatch',
  COMMAND_VALUE_NOT_ELIGIBLE: 'command_value_not_eligible',
  INVALID_ADMISSION_RESULT: 'invalid_admission_result',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_COMMAND_VALUE_LENGTH = 120;

const commandSchema = z.object({
  commandId: z.string().trim().min(1).max(80),
  controlId: z.string().trim().min(1).max(80),
  intentId: z.string().trim().min(1).max(80),
  decisionEffectId: z.string().trim().min(1).max(80),
  certificationSemanticId: z.string().trim().min(1).max(80).nullable(),
  values: z.array(z.string().trim().min(1).max(MAX_COMMAND_VALUE_LENGTH)).length(1),
  sourceId: z.literal('operator_declared'),
  explicitOperatorAction: z.literal(true),
  inferredFromAbsence: z.literal(false),
}).strict();

const requestSchema = z.object({
  version: z.literal(POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION),
  command: commandSchema,
}).strict();

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function serializedByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeActor(actor = {}) {
  const source = asObject(actor);
  const id = normalizePositiveInteger(source.id);

  return {
    id,
    role: typeof source.role === 'string' ? source.role.trim() : '',
    authenticated: source.authenticated === true,
  };
}

function normalizeLibrary(library = {}) {
  const source = asObject(library);

  return {
    id: normalizePositiveInteger(source.id ?? source.libraryId),
    media_type: typeof (source.media_type ?? source.mediaType) === 'string'
      ? (source.media_type ?? source.mediaType).trim()
      : '',
  };
}

function formatPath(path = []) {
  return path.length > 0 ? path.join('.') : '(root)';
}

function normalizeRequestIssues(issues = []) {
  return issues.flatMap(issue => {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
      return issue.keys.map(key => ({
        path: formatPath([...(issue.path || []), key]),
        message: `Unsupported property: ${key}.`,
      }));
    }

    return [{
      path: formatPath(issue.path || []),
      message: issue.message || 'Invalid value.',
    }];
  });
}

function validatePolicyConstraintWriteAdmissionRequest(payload = {}) {
  if (serializedByteLength(payload) > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      request: null,
      issues: [{
        path: '(root)',
        message: `Constraint write admission requests must stay below ${MAX_REQUEST_BYTES} bytes.`,
      }],
    };
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      request: null,
      issues: normalizeRequestIssues(parsed.error.issues),
    };
  }

  return {
    ok: true,
    request: parsed.data,
    issues: [],
  };
}

function buildPolicyConstraintWriteAdmissionAuthority() {
  return {
    serverAdmission: true,
    clientCommandAuthoritative: false,
    policyPersistence: false,
    runtimeDecision: false,
    routingExecution: false,
    learningMutation: false,
  };
}

function buildPolicyConstraintWriteAdmissionSideEffects() {
  return {
    libraryContextRead: true,
    policyStorageMutated: false,
    runtimeDecisionExecuted: false,
    routingExecuted: false,
    learningMutated: false,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
  };
}

function buildPolicyConstraintWriteAdmissionIssue(riskId, message) {
  return { riskId, message };
}

function buildPolicyConstraintWriteAdmissionResult({
  statusId,
  ok,
  library,
  admittedCommand = null,
  issue = null,
} = {}) {
  const issues = issue ? [issue] : [];
  const normalizedLibrary = normalizeLibrary(library);

  return {
    version: POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION,
    ok,
    statusId,
    issueCount: issues.length,
    issues,
    library: {
      id: normalizedLibrary.id,
      mediaTypeFamilyId: normalizeLibraryMediaTypeFamily(normalizedLibrary),
    },
    admittedCommand,
    authority: buildPolicyConstraintWriteAdmissionAuthority(),
    sideEffects: buildPolicyConstraintWriteAdmissionSideEffects(),
    rawPayloadExposed: false,
    nextStep: ok
      ? {
        stepId: 'native_constraint_storage',
        label: 'Native Constraint Storage',
        reason: 'This command is admitted for a future storage boundary, which must revalidate it in its own transaction.',
      }
      : null,
  };
}

export {
  POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION,
  POLICY_CONSTRAINT_WRITE_ADMISSION_RISK_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_STATUS_IDS,
  POLICY_CONSTRAINT_WRITE_ADMISSION_VERSION,
  asObject,
  buildPolicyConstraintWriteAdmissionAuthority,
  buildPolicyConstraintWriteAdmissionIssue,
  buildPolicyConstraintWriteAdmissionResult,
  buildPolicyConstraintWriteAdmissionSideEffects,
  normalizeActor,
  normalizeLibrary,
  normalizePositiveInteger,
  validatePolicyConstraintWriteAdmissionRequest,
};
