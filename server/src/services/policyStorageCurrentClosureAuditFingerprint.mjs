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

const POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_VERSION =
  'policy.storage_current_closure_audit_fingerprint.v1';

const POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_RISK_IDS = Object.freeze({
  MISSING_AUDIT: 'missing_audit',
  MISSING_FINGERPRINT: 'missing_fingerprint',
  MALFORMED_FINGERPRINT: 'malformed_fingerprint',
  FINGERPRINT_MISMATCH: 'fingerprint_mismatch',
  PROVENANCE_MISMATCH: 'provenance_mismatch',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  return Object.keys(value)
    .filter(key => !['function', 'symbol', 'undefined'].includes(typeof value[key]))
    .sort()
    .reduce((normalized, key) => {
      normalized[key] = stableValue(value[key]);
      return normalized;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function normalizeRisks(risks = []) {
  return asArray(risks)
    .map(risk => stableValue(asObject(risk)))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function buildPolicyStorageCurrentClosureAuditProjection(audit = {}) {
  const value = asObject(audit);

  return {
    version: POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_VERSION,
    audit: {
      version: value.version || null,
      generatedAt: value.generatedAt || null,
      statusId: value.statusId || null,
      complete: value.complete === true,
      closureInput: stableValue(asObject(value.closureInput)),
      currentEvidence: stableValue(asObject(value.currentEvidence)),
      checkpointArtifact: stableValue(asObject(value.checkpointArtifact)),
      finalReadout: stableValue(asObject(value.finalReadout)),
      summary: stableValue(asObject(value.summary)),
      riskCount: value.riskCount ?? null,
      risks: normalizeRisks(value.risks),
      sideEffects: stableValue(asObject(value.sideEffects)),
      executionPolicy: stableValue(asObject(value.executionPolicy)),
      nextStep: stableValue(asObject(value.nextStep)),
    },
  };
}

function buildPolicyStorageCurrentClosureAuditFingerprint({ audit = {} } = {}) {
  const projection = buildPolicyStorageCurrentClosureAuditProjection(audit);
  const fingerprint = createHash('sha256')
    .update(stableStringify(projection))
    .digest('hex');

  return {
    version: POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_VERSION,
    algorithm: 'sha256',
    fingerprint,
    provenance: {
      auditVersion: projection.audit.version,
      generatedAt: projection.audit.generatedAt,
      statusId: projection.audit.statusId,
      complete: projection.audit.complete,
      completionAuditArtifactFingerprint:
        projection.audit.closureInput.completionAuditArtifact?.artifactFingerprint?.fingerprint ||
        null,
      evidenceRunStatusId:
        projection.audit.currentEvidence.evidenceRun?.statusId || null,
      checkpointArtifactStatusId:
        projection.audit.checkpointArtifact.statusId || null,
      finalReadoutStatusId: projection.audit.finalReadout.statusId || null,
    },
  };
}

function validatePolicyStorageCurrentClosureAuditFingerprint({
  audit = null,
  artifactFingerprint = null,
} = {}) {
  const issues = [];

  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) {
    issues.push({
      riskId: POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_RISK_IDS.MISSING_AUDIT,
      message: 'Current closure audit fingerprint validation requires an audit object.',
    });
  }

  if (
    !artifactFingerprint ||
    typeof artifactFingerprint !== 'object' ||
    Array.isArray(artifactFingerprint)
  ) {
    issues.push({
      riskId:
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_RISK_IDS.MISSING_FINGERPRINT,
      message: 'Current closure audit fingerprint validation requires a fingerprint object.',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issueCount: issues.length, issues };
  }

  const expected = buildPolicyStorageCurrentClosureAuditFingerprint({ audit });
  const actualFingerprint = String(artifactFingerprint.fingerprint || '')
    .trim()
    .toLowerCase();

  if (
    artifactFingerprint.version !== POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_VERSION ||
    artifactFingerprint.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(actualFingerprint)
  ) {
    issues.push({
      riskId:
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_RISK_IDS
          .MALFORMED_FINGERPRINT,
      message: 'Current closure audit fingerprint must be a versioned SHA-256 hex digest.',
    });
  }

  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push({
      riskId:
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_RISK_IDS
          .FINGERPRINT_MISMATCH,
      message: 'Current closure audit fingerprint must match its exact bounded audit projection.',
    });
  }

  const provenance = asObject(artifactFingerprint.provenance);
  if (
    provenance.auditVersion !== expected.provenance.auditVersion ||
    provenance.generatedAt !== expected.provenance.generatedAt ||
    provenance.statusId !== expected.provenance.statusId ||
    provenance.complete !== expected.provenance.complete ||
    provenance.completionAuditArtifactFingerprint !==
      expected.provenance.completionAuditArtifactFingerprint ||
    provenance.evidenceRunStatusId !== expected.provenance.evidenceRunStatusId ||
    provenance.checkpointArtifactStatusId !==
      expected.provenance.checkpointArtifactStatusId ||
    provenance.finalReadoutStatusId !== expected.provenance.finalReadoutStatusId
  ) {
    issues.push({
      riskId:
        POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_RISK_IDS
          .PROVENANCE_MISMATCH,
      message: 'Current closure audit fingerprint provenance must match the bounded audit projection.',
    });
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_RISK_IDS,
  POLICY_STORAGE_CURRENT_CLOSURE_AUDIT_FINGERPRINT_VERSION,
  buildPolicyStorageCurrentClosureAuditFingerprint,
  buildPolicyStorageCurrentClosureAuditProjection,
  validatePolicyStorageCurrentClosureAuditFingerprint,
};
