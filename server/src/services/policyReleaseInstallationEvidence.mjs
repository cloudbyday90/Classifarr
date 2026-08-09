/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  asObject,
  isIsoTimestamp,
  normalizeString,
  sha256,
  stableStringify,
} from './policyReleaseAcceptanceShared.mjs';

const POLICY_RELEASE_INSTALLATION_EVIDENCE_VERSION =
  'policy.release_installation_evidence.v1';

const SOURCE_REVISION_PATTERN = /^[a-f0-9]{7,64}$/i;
const DEPLOYMENT_FINGERPRINT_PATTERN = /^[a-z0-9][a-z0-9._:@/+:-]{6,254}$/i;
const ENVIRONMENT_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/i;

function normalizeApprovalWorkflowUrl(value) {
  const normalized = normalizeString(value, 500);

  try {
    const url = new URL(normalized);
    const isWorkflowRun = /^\/.*\/actions\/runs\/\d+\/?$/.test(url.pathname);

    return url.protocol === 'https:' && isWorkflowRun && !url.search && !url.hash
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

function buildPolicyReleaseInstallationEvidenceFingerprintPayload(evidence = {}) {
  const source = asObject(evidence);

  return {
    version: POLICY_RELEASE_INSTALLATION_EVIDENCE_VERSION,
    generatedAt: source.generatedAt || null,
    deploymentFingerprint: normalizeString(source.deploymentFingerprint, 255),
    sourceRevision: normalizeString(source.sourceRevision, 64).toLowerCase(),
    approvalWorkflow: {
      environmentName: normalizeString(source.approvalWorkflow?.environmentName, 120),
      workflowRunUrl: normalizeApprovalWorkflowUrl(source.approvalWorkflow?.workflowRunUrl),
      changeReference: normalizeString(source.approvalWorkflow?.changeReference, 120),
      attestedAt: source.approvalWorkflow?.attestedAt || null,
    },
  };
}

function buildInstallationEvidenceFingerprint(evidence = {}) {
  return sha256(stableStringify(
    buildPolicyReleaseInstallationEvidenceFingerprintPayload(evidence)
  ));
}

function buildPolicyReleaseInstallationEvidence({
  deploymentFingerprint,
  sourceRevision,
  approvalWorkflow = {},
  generatedAt = null,
} = {}) {
  const evidence = {
    version: POLICY_RELEASE_INSTALLATION_EVIDENCE_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    deploymentFingerprint: normalizeString(deploymentFingerprint, 255),
    sourceRevision: normalizeString(sourceRevision, 64).toLowerCase(),
    approvalWorkflow: {
      environmentName: normalizeString(approvalWorkflow.environmentName, 120),
      workflowRunUrl: normalizeApprovalWorkflowUrl(approvalWorkflow.workflowRunUrl),
      changeReference: normalizeString(approvalWorkflow.changeReference, 120),
      attestedAt: approvalWorkflow.attestedAt || null,
    },
    privacy: {
      includesOperatorIdentity: false,
      includesInstallationConfiguration: false,
      includesSecrets: false,
    },
  };
  const completedEvidence = {
    ...evidence,
    evidenceFingerprint: {
      algorithm: 'sha256',
      fingerprint: buildInstallationEvidenceFingerprint(evidence),
    },
  };

  return {
    ...completedEvidence,
    validation: validatePolicyReleaseInstallationEvidence(completedEvidence),
  };
}

function validatePolicyReleaseInstallationEvidence(evidence = {}) {
  const source = asObject(evidence);
  const issues = [];
  const deploymentFingerprint = normalizeString(source.deploymentFingerprint, 255);
  const sourceRevision = normalizeString(source.sourceRevision, 64);
  const approvalWorkflow = asObject(source.approvalWorkflow);
  const evidenceFingerprint = normalizeString(source.evidenceFingerprint?.fingerprint, 64).toLowerCase();

  if (source.version !== POLICY_RELEASE_INSTALLATION_EVIDENCE_VERSION) {
    issues.push('unknown_installation_evidence_version');
  }
  if (!isIsoTimestamp(source.generatedAt)) {
    issues.push('invalid_generated_at');
  }
  if (!DEPLOYMENT_FINGERPRINT_PATTERN.test(deploymentFingerprint)) {
    issues.push('invalid_deployment_fingerprint');
  }
  if (!SOURCE_REVISION_PATTERN.test(sourceRevision)) {
    issues.push('invalid_source_revision');
  }
  if (!ENVIRONMENT_NAME_PATTERN.test(normalizeString(approvalWorkflow.environmentName, 120))) {
    issues.push('invalid_approval_environment');
  }
  if (!normalizeApprovalWorkflowUrl(approvalWorkflow.workflowRunUrl)) {
    issues.push('invalid_approval_workflow_url');
  }
  if (!normalizeString(approvalWorkflow.changeReference, 120)) {
    issues.push('missing_change_reference');
  }
  if (!isIsoTimestamp(approvalWorkflow.attestedAt)) {
    issues.push('invalid_approval_attestation_time');
  }
  if (
    source.privacy?.includesOperatorIdentity !== false ||
    source.privacy?.includesInstallationConfiguration !== false ||
    source.privacy?.includesSecrets !== false
  ) {
    issues.push('privacy_boundary_invalid');
  }
  if (
    source.evidenceFingerprint?.algorithm !== 'sha256' ||
    !/^[a-f0-9]{64}$/.test(evidenceFingerprint) ||
    evidenceFingerprint !== buildInstallationEvidenceFingerprint(source)
  ) {
    issues.push('installation_evidence_fingerprint_invalid');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RELEASE_INSTALLATION_EVIDENCE_VERSION,
  buildPolicyReleaseInstallationEvidence,
  buildPolicyReleaseInstallationEvidenceFingerprintPayload,
  validatePolicyReleaseInstallationEvidence,
};
