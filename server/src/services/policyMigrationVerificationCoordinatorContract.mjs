/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_MIGRATION_VERIFICATION_COORDINATOR_VERSION =
  'policy.migration_verification_coordinator.v1';

const POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INSUFFICIENT_REPRESENTATIVE_COVERAGE: 'insufficient_representative_coverage',
  INVALID_REBUILD_PROPOSAL: 'invalid_rebuild_proposal',
  INVALID_ACCEPTANCE_TRANSITION: 'invalid_acceptance_transition',
  SOURCE_AUDIT_FAILED: 'source_audit_failed',
  SOURCE_UNAVAILABLE: 'source_unavailable',
  VERIFIER_AUDIT_FAILED: 'verifier_audit_failed',
  COORDINATION_FAILED: 'coordination_failed',
});

const POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS = Object.freeze({
  INVALID_REBUILD_PROPOSAL: 'invalid_rebuild_proposal',
  INVALID_ACCEPTANCE_TRANSITION: 'invalid_acceptance_transition',
  SOURCE_AUDIT_FAILED: 'source_audit_failed',
  SOURCE_UNAVAILABLE: 'source_unavailable',
  VERIFIER_AUDIT_FAILED: 'verifier_audit_failed',
  COORDINATION_FAILED: 'coordination_failed',
  INVALID_COORDINATOR_VERSION: 'invalid_coordinator_version',
  STATUS_MISMATCH: 'status_mismatch',
  POLICY_CONTEXT_MISMATCH: 'policy_context_mismatch',
  SOURCE_PROVENANCE_MISMATCH: 'source_provenance_mismatch',
  SAMPLE_OUTPUT_EXPOSED: 'sample_output_exposed',
  VERIFIER_REPORT_MISMATCH: 'verifier_report_mismatch',
  NORMAL_WORKFLOW_SURFACE: 'normal_workflow_surface',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_SAFETY_DECLARATION: 'missing_safety_declaration',
});

const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const REQUIRED_SIDE_EFFECT_IDS = Object.freeze([
  'databaseRead',
  'policyStorageMutated',
  'classificationStorageMutated',
  'routingWritten',
  'rollbackCreated',
  'liveMediaServerLookupPerformed',
  'liveProviderLookupPerformed',
  'providerQuotaRead',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function buildIssue(riskId) {
  return { riskId };
}

function summarizeAudit(value = {}) {
  const audit = asObject(value);
  const issueRiskIds = [...new Set(asArray(audit.issues)
    .map(issue => normalizeString(asObject(issue).riskId, 120))
    .filter(Boolean))];

  return {
    ok: audit.ok === true,
    issueCount: Number.isInteger(Number(audit.issueCount))
      ? Math.max(0, Number(audit.issueCount))
      : issueRiskIds.length,
    issueRiskIds,
  };
}

function summarizePolicyContext(value = {}) {
  const policyContext = asObject(value);

  return {
    policyId: normalizePositiveInteger(policyContext.policyId ?? policyContext.policy_id),
    intentId: normalizePositiveInteger(policyContext.intentId ?? policyContext.intent_id),
    libraryId: normalizePositiveInteger(policyContext.libraryId ?? policyContext.library_id),
  };
}

function summarizeSourceProvenance(value = {}) {
  const provenance = asObject(value);

  return {
    sourceId: normalizeString(provenance.sourceId, 120) || null,
    policyId: normalizePositiveInteger(provenance.policyId),
    libraryId: normalizePositiveInteger(provenance.libraryId),
    mediaType: normalizeString(provenance.mediaType, 20).toLowerCase() || null,
    deterministicOrderId: normalizeString(provenance.deterministicOrderId, 120) || null,
  };
}

function summarizeSource(value = {}, audit = {}) {
  const source = asObject(value);
  const summary = asObject(source.summary);

  return {
    statusId: normalizeString(source.statusId, 120) || null,
    ready: source.ready === true,
    summary: {
      maximumClassifications: Number(summary.maximumClassifications) || 0,
      sourceRowsRead: Number(summary.sourceRowsRead) || 0,
      sourceRowsConsidered: Number(summary.sourceRowsConsidered) || 0,
      representativeClassificationCount: Number(summary.representativeClassificationCount) || 0,
      unusableSourceRowCount: Number(summary.unusableSourceRowCount) || 0,
      sourceRowsTruncated: source.summary?.sourceRowsTruncated === true,
      coverageSufficient: source.summary?.coverageSufficient === true,
    },
    provenance: summarizeSourceProvenance(source.sourceProvenance),
    audit: summarizeAudit(audit),
  };
}

function summarizeVerifier(value = {}, audit = {}) {
  const report = asObject(value);
  const differenceSummary = asObject(report.differenceSummary);

  return {
    statusId: normalizeString(report.statusId, 120) || null,
    differenceSummary: {
      totalCount: Number(differenceSummary.totalCount) || 0,
      emittedCount: Number(differenceSummary.emittedCount) || 0,
      truncated: differenceSummary.truncated === true,
    },
    audit: summarizeAudit(audit),
  };
}

function buildSideEffects({ databaseRead = false } = {}) {
  return {
    databaseRead: databaseRead === true,
    policyStorageMutated: false,
    classificationStorageMutated: false,
    routingWritten: false,
    rollbackCreated: false,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
  };
}

function buildPolicyMigrationVerificationCoordinatorResult({
  statusId,
  ok,
  evaluatedAt = null,
  policyContext = {},
  acceptanceTransition = {},
  sourceResult = {},
  sourceAudit = {},
  verifierReport = null,
  verifierAudit = {},
  databaseRead = false,
  issueRiskId = null,
} = {}) {
  const report = verifierReport && typeof verifierReport === 'object'
    ? verifierReport
    : null;
  const source = summarizeSource(sourceResult, sourceAudit);
  const issues = issueRiskId ? [buildIssue(issueRiskId)] : [];

  return {
    version: POLICY_MIGRATION_VERIFICATION_COORDINATOR_VERSION,
    statusId,
    ok: ok === true,
    evaluatedAt: normalizeString(evaluatedAt, 40) || null,
    policyContext: summarizePolicyContext(policyContext),
    acceptanceTransition: {
      fingerprint: normalizeString(
        asObject(acceptanceTransition).transitionFingerprint?.fingerprint,
        64
      ) || null,
    },
    source,
    verification: {
      completed: statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY,
      canApplyReplacement: false,
      canDeleteLegacyPaths: false,
      verifier: report ? summarizeVerifier(report, verifierAudit) : null,
    },
    verifierReport: report,
    normalWorkflowSurface: false,
    issueCount: issues.length,
    issues,
    sideEffects: buildSideEffects({ databaseRead }),
  };
}

function buildPolicyMigrationVerificationCoordinatorAudit(result = {}) {
  const coordinator = asObject(result);
  const source = asObject(coordinator.source);
  const sourceSummary = asObject(source.summary);
  const sourceProvenance = asObject(source.provenance);
  const sourceAudit = asObject(source.audit);
  const verification = asObject(coordinator.verification);
  const verifierAudit = asObject(verification.verifier?.audit);
  const policyContext = summarizePolicyContext(coordinator.policyContext);
  const allowedStatuses = Object.values(
    POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS
  );
  const issues = [];
  const statusId = normalizeString(coordinator.statusId, 120);
  const sourceIsReady = source.ready === true && sourceAudit.ok === true;
  const sourceHasInsufficientCoverage =
    source.statusId === 'insufficient_representative_coverage' &&
    source.ready === false && sourceAudit.ok === true;

  if (coordinator.version !== POLICY_MIGRATION_VERIFICATION_COORDINATOR_VERSION) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.INVALID_COORDINATOR_VERSION
    ));
  }

  if (!allowedStatuses.includes(statusId)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.STATUS_MISMATCH
    ));
  }

  if (Object.hasOwn(coordinator, 'representativeClassifications') ||
      Object.hasOwn(source, 'representativeClassifications') ||
      Object.hasOwn(asObject(coordinator.verifierReport), 'representativeClassifications')) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SAMPLE_OUTPUT_EXPOSED
    ));
  }

  if (statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY &&
      (coordinator.ok !== true || verification.completed !== true || !sourceIsReady ||
        !coordinator.verifierReport || verifierAudit.ok !== true)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.STATUS_MISMATCH
    ));
  }

  if (statusId ===
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS
        .INSUFFICIENT_REPRESENTATIVE_COVERAGE &&
      (coordinator.ok !== true || verification.completed !== false ||
        !sourceHasInsufficientCoverage || coordinator.verifierReport !== null)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.STATUS_MISMATCH
    ));
  }

  if (statusId !== POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY &&
      statusId !== POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS
        .INSUFFICIENT_REPRESENTATIVE_COVERAGE &&
      (coordinator.ok !== false || verification.completed !== false ||
        coordinator.verifierReport !== null)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.STATUS_MISMATCH
    ));
  }

  if ((statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY ||
      statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS
        .INSUFFICIENT_REPRESENTATIVE_COVERAGE ||
      statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.SOURCE_AUDIT_FAILED ||
      statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.SOURCE_UNAVAILABLE) &&
      (!policyContext.policyId || !policyContext.intentId || !policyContext.libraryId)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.POLICY_CONTEXT_MISMATCH
    ));
  }

  if (sourceIsReady || sourceHasInsufficientCoverage) {
    if (sourceProvenance.policyId !== policyContext.policyId ||
        sourceProvenance.libraryId !== policyContext.libraryId ||
        !sourceProvenance.sourceId || !sourceProvenance.mediaType ||
        !sourceProvenance.deterministicOrderId ||
        Number(sourceSummary.representativeClassificationCount) < 0 ||
        Number(sourceSummary.sourceRowsConsidered) <
          Number(sourceSummary.representativeClassificationCount)) {
      issues.push(buildIssue(
        POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SOURCE_PROVENANCE_MISMATCH
      ));
    }
  }

  if (statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY &&
      verification.verifier?.statusId !== coordinator.verifierReport?.statusId) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.VERIFIER_REPORT_MISMATCH
    ));
  }

  if (coordinator.normalWorkflowSurface !== false) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.NORMAL_WORKFLOW_SURFACE
    ));
  }

  if (verification.canApplyReplacement !== false || verification.canDeleteLegacyPaths !== false) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.MISSING_SAFETY_DECLARATION
    ));
  }

  const sideEffects = asObject(coordinator.sideEffects);
  if (REQUIRED_SIDE_EFFECT_IDS.some(key => typeof sideEffects[key] !== 'boolean')) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.MISSING_SAFETY_DECLARATION
    ));
  }

  Object.entries(sideEffects).forEach(([key, value]) => {
    if (key !== 'databaseRead' && value === true) {
      issues.push(buildIssue(
        POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.SIDE_EFFECT_PERFORMED
      ));
    }
  });

  const transitionFingerprint = normalizeString(
    coordinator.acceptanceTransition?.fingerprint,
    64
  );
  if ((statusId === POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS.READY ||
      sourceIsReady || sourceHasInsufficientCoverage) &&
      !SHA256_FINGERPRINT_PATTERN.test(transitionFingerprint)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS.INVALID_ACCEPTANCE_TRANSITION
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_RISK_IDS,
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_STATUS_IDS,
  POLICY_MIGRATION_VERIFICATION_COORDINATOR_VERSION,
  buildPolicyMigrationVerificationCoordinatorAudit,
  buildPolicyMigrationVerificationCoordinatorResult,
};
