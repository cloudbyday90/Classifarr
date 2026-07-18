/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_STORAGE_CLOSURE_SCOPE_IDS = Object.freeze({
  REPOSITORY: 'repository',
  ACTIVE_INSTALLATION: 'active_installation',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildPolicyStorageImplementationReadinessScope({
  implementationReadiness = {},
} = {}) {
  const readiness = asObject(implementationReadiness);

  return {
    scope: POLICY_STORAGE_CLOSURE_SCOPE_IDS.REPOSITORY,
    statusId: readiness.statusId || null,
    ready: readiness.ready === true,
    validationOk: readiness.validationOk === true,
    riskCount: readiness.riskCount ?? null,
    risks: asArray(readiness.risks),
  };
}

function buildPolicyStorageInstanceCutoverScope({
  finalRemovalAudit = {},
} = {}) {
  const audit = asObject(finalRemovalAudit);

  return {
    scope: POLICY_STORAGE_CLOSURE_SCOPE_IDS.ACTIVE_INSTALLATION,
    requiredForStorageClosure: true,
    statusId: audit.statusId || null,
    ready:
      audit.complete === true &&
      audit.validationOk === true &&
      audit.integrityOk === true,
    integrityOk: audit.integrityOk === true,
    validationOk: audit.validationOk === true,
    riskCount: asArray(audit.risks).length,
    risks: asArray(audit.risks),
  };
}

function buildPolicyStorageClosureScopes({
  implementationReadiness = {},
  finalRemovalAudit = {},
} = {}) {
  return {
    implementationReadiness: buildPolicyStorageImplementationReadinessScope({
      implementationReadiness,
    }),
    instanceCutover: buildPolicyStorageInstanceCutoverScope({
      finalRemovalAudit,
    }),
  };
}

function isPolicyStorageImplementationReady(scopes = {}) {
  return asObject(scopes.implementationReadiness).scope ===
    POLICY_STORAGE_CLOSURE_SCOPE_IDS.REPOSITORY &&
    scopes.implementationReadiness.ready === true;
}

function isPolicyStorageInstanceCutoverReady(scopes = {}) {
  return asObject(scopes.instanceCutover).scope ===
    POLICY_STORAGE_CLOSURE_SCOPE_IDS.ACTIVE_INSTALLATION &&
    scopes.instanceCutover.requiredForStorageClosure === true &&
    scopes.instanceCutover.ready === true;
}

export {
  POLICY_STORAGE_CLOSURE_SCOPE_IDS,
  buildPolicyStorageClosureScopes,
  buildPolicyStorageImplementationReadinessScope,
  buildPolicyStorageInstanceCutoverScope,
  isPolicyStorageImplementationReady,
  isPolicyStorageInstanceCutoverReady,
};
