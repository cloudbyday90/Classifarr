/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS = Object.freeze({
  LIBRARY_REBUILD_CUTOVER: 'library_rebuild_cutover',
});

const POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS = Object.freeze({
  INVALID_INVOCATION_SCOPE: 'invalid_invocation_scope',
  INVALID_INVOCATION_INPUT: 'invalid_invocation_input',
  UNEXPECTED_INVOCATION_FIELD: 'unexpected_invocation_field',
  UNSAFE_INVOCATION_INPUT: 'unsafe_invocation_input',
});

const SUPPORTED_INPUT_FIELDS = new Set([
  'proposal',
  'acceptanceTransition',
  'now',
]);

const ACCEPTED_SCOPE_IDS = new Set(
  Object.values(POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS)
);

function asPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : null;
}

function buildIssue(riskId, message) {
  return { riskId, message };
}

function cloneInvocationInput(input) {
  try {
    return structuredClone(input);
  } catch {
    return null;
  }
}

function buildPolicyMigrationVerificationInvocationAdmission({
  invocationScopeId = null,
  input = {},
} = {}) {
  const issues = [];
  const normalizedInput = asPlainObject(input);

  if (!ACCEPTED_SCOPE_IDS.has(invocationScopeId)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.INVALID_INVOCATION_SCOPE,
      'Migration verification may run only from the server-owned library rebuild cutover.',
    ));
  }

  if (!normalizedInput) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.INVALID_INVOCATION_INPUT,
      'Migration verification requires one plain server-owned invocation object.',
    ));
  } else {
    const unexpectedFields = Object.keys(normalizedInput).filter(field =>
      !SUPPORTED_INPUT_FIELDS.has(field)
    );
    if (unexpectedFields.length > 0) {
      issues.push(buildIssue(
        POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.UNEXPECTED_INVOCATION_FIELD,
        'Migration verification rejects caller-controlled fields outside its fixed invocation contract.',
      ));
    }

    if (!asPlainObject(normalizedInput.proposal) ||
        !asPlainObject(normalizedInput.acceptanceTransition) ||
        !(normalizedInput.now instanceof Date) ||
        Number.isNaN(normalizedInput.now.getTime())) {
      issues.push(buildIssue(
        POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.INVALID_INVOCATION_INPUT,
        'Migration verification requires a proposal, accepted transition, and valid server evaluation time.',
      ));
    }
  }

  const acceptedInput = issues.length === 0
    ? cloneInvocationInput({
      proposal: normalizedInput.proposal,
      acceptanceTransition: normalizedInput.acceptanceTransition,
      now: normalizedInput.now,
    })
    : null;

  if (issues.length === 0 && !acceptedInput) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS.UNSAFE_INVOCATION_INPUT,
      'Migration verification could not safely isolate the server-owned invocation input.',
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    invocationScopeId: ACCEPTED_SCOPE_IDS.has(invocationScopeId) ? invocationScopeId : null,
    acceptedInput: issues.length === 0 ? acceptedInput : null,
    normalWorkflowSurface: false,
    sideEffects: {
      databaseRead: false,
      verificationRunPersisted: false,
      policyStorageMutated: false,
      routingWritten: false,
      learningWritten: false,
      providerAccessed: false,
      schedulerTriggered: false,
    },
  };
}

export {
  POLICY_MIGRATION_VERIFICATION_INVOCATION_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_INVOCATION_SCOPE_IDS,
  buildPolicyMigrationVerificationInvocationAdmission,
};
