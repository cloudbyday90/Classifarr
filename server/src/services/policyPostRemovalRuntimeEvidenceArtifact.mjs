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

import { createHash } from 'node:crypto';

const POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION =
  'policy.post_removal_runtime_evidence_artifact.v2';

const POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS = Object.freeze({
  MISSING_RUNTIME_EVIDENCE_ARTIFACT: 'missing_runtime_evidence_artifact',
  MALFORMED_RUNTIME_EVIDENCE_ARTIFACT: 'malformed_runtime_evidence_artifact',
  RUNTIME_EVIDENCE_ARTIFACT_MISMATCH: 'runtime_evidence_artifact_mismatch',
  RUNTIME_EVIDENCE_PROVENANCE_MISMATCH: 'runtime_evidence_provenance_mismatch',
  APPLIED_REVIEW_FINGERPRINT_MISSING: 'applied_review_fingerprint_missing',
  APPLIED_REVIEW_FINGERPRINT_MALFORMED: 'applied_review_fingerprint_malformed',
  APPLIED_EXECUTION_PLAN_FINGERPRINT_MISSING:
    'applied_execution_plan_fingerprint_missing',
  APPLIED_EXECUTION_PLAN_FINGERPRINT_MALFORMED:
    'applied_execution_plan_fingerprint_malformed',
  IMPORT_SCAN_REVIEW_BINDING_MISSING: 'import_scan_review_binding_missing',
  IMPORT_SCAN_REVIEW_BINDING_MISMATCH: 'import_scan_review_binding_mismatch',
  RUNTIME_CHECK_REVIEW_BINDING_MISSING: 'runtime_check_review_binding_missing',
  RUNTIME_CHECK_REVIEW_BINDING_MISMATCH: 'runtime_check_review_binding_mismatch',
  FOCUSED_VALIDATION_REVIEW_BINDING_MISSING:
    'focused_validation_review_binding_missing',
  FOCUSED_VALIDATION_REVIEW_BINDING_MISMATCH:
    'focused_validation_review_binding_mismatch',
  FULL_VALIDATION_REVIEW_BINDING_MISSING: 'full_validation_review_binding_missing',
  FULL_VALIDATION_REVIEW_BINDING_MISMATCH: 'full_validation_review_binding_mismatch',
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

function normalizeFingerprint(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function listAppliedPaths(applyEvidence = {}) {
  return asArray(applyEvidence.applyBatch?.results)
    .map(result => normalizePath(result?.path))
    .filter(Boolean);
}

function reviewArtifactFingerprintFromApplyEvidence(applyEvidence = {}) {
  return normalizeFingerprint(
    asObject(applyEvidence.removalReview).reviewArtifactFingerprint
  );
}

function executionPlanArtifactFingerprintFromApplyEvidence(applyEvidence = {}) {
  return normalizeFingerprint(
    asObject(applyEvidence.removalReview).executionPlanArtifactFingerprint
  );
}

function buildPolicyPostRemovalRuntimeEvidenceArtifactProjection({
  applyEvidence = {},
  importScan = {},
  runtimeChecks = [],
  validationEvidence = {},
} = {}) {
  return {
    version: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION,
    evidence: {
      applyEvidence: stableValue(asObject(applyEvidence)),
      importScan: stableValue(asObject(importScan)),
      runtimeChecks: stableValue(asArray(runtimeChecks)),
      validationEvidence: stableValue(asObject(validationEvidence)),
    },
  };
}

function buildPolicyPostRemovalRuntimeEvidenceArtifact({
  applyEvidence = {},
  importScan = {},
  runtimeChecks = [],
  validationEvidence = {},
} = {}) {
  const projection = buildPolicyPostRemovalRuntimeEvidenceArtifactProjection({
    applyEvidence,
    importScan,
    runtimeChecks,
    validationEvidence,
  });
  const reviewArtifactFingerprint = reviewArtifactFingerprintFromApplyEvidence(
    projection.evidence.applyEvidence
  );
  const executionPlanArtifactFingerprint =
    executionPlanArtifactFingerprintFromApplyEvidence(
      projection.evidence.applyEvidence
    );
  const normalizedImportScan = asObject(projection.evidence.importScan);
  const normalizedValidationEvidence = asObject(projection.evidence.validationEvidence);

  return {
    version: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION,
    algorithm: 'sha256',
    fingerprint: createHash('sha256')
      .update(stableStringify(projection))
      .digest('hex'),
    evidence: projection.evidence,
    provenance: {
      reviewArtifactFingerprint: reviewArtifactFingerprint || null,
      executionPlanArtifactFingerprint:
        executionPlanArtifactFingerprint || null,
      appliedPaths: listAppliedPaths(projection.evidence.applyEvidence),
      importScanReviewArtifactFingerprint:
        normalizeFingerprint(normalizedImportScan.reviewArtifactFingerprint) || null,
      runtimeCheckCount: asArray(projection.evidence.runtimeChecks).length,
      runtimeCheckReviewArtifactFingerprints: asArray(projection.evidence.runtimeChecks)
        .map(check => normalizeFingerprint(check?.reviewArtifactFingerprint) || null),
      focusedValidationReviewArtifactFingerprint:
        normalizeFingerprint(asObject(normalizedValidationEvidence.focused)
          .reviewArtifactFingerprint) || null,
      fullValidationReviewArtifactFingerprint:
        normalizeFingerprint(asObject(normalizedValidationEvidence.full)
          .reviewArtifactFingerprint) || null,
    },
  };
}

function buildIssue(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function validateBinding({
  expectedFingerprint,
  actualFingerprint,
  missingRiskId,
  mismatchRiskId,
  messagePrefix,
  metadata = {},
}) {
  if (!actualFingerprint) {
    return buildIssue(
      missingRiskId,
      `${messagePrefix} must declare the applied removal review artifact fingerprint.`,
      metadata
    );
  }

  if (actualFingerprint !== expectedFingerprint) {
    return buildIssue(
      mismatchRiskId,
      `${messagePrefix} must be bound to the same applied removal review artifact.`,
      {
        ...metadata,
        expectedReviewArtifactFingerprint: expectedFingerprint,
        actualReviewArtifactFingerprint: actualFingerprint,
      }
    );
  }

  return null;
}

function validateEvidenceBindings(evidence = {}) {
  const issues = [];
  const applyEvidence = asObject(evidence.applyEvidence);
  const reviewArtifactFingerprint = reviewArtifactFingerprintFromApplyEvidence(applyEvidence);
  const executionPlanArtifactFingerprint =
    executionPlanArtifactFingerprintFromApplyEvidence(applyEvidence);

  if (!reviewArtifactFingerprint) {
    issues.push(buildIssue(
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .APPLIED_REVIEW_FINGERPRINT_MISSING,
      'Runtime evidence requires the applied removal review artifact fingerprint.'
    ));

    return {
      reviewArtifactFingerprint: null,
      executionPlanArtifactFingerprint: null,
      issues,
    };
  }

  if (!SHA256_FINGERPRINT_PATTERN.test(reviewArtifactFingerprint)) {
    issues.push(buildIssue(
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .APPLIED_REVIEW_FINGERPRINT_MALFORMED,
      'Applied removal review artifact fingerprint must be a SHA-256 digest.',
      { actualReviewArtifactFingerprint: reviewArtifactFingerprint }
    ));

    return {
      reviewArtifactFingerprint,
      executionPlanArtifactFingerprint: null,
      issues,
    };
  }

  if (!executionPlanArtifactFingerprint) {
    issues.push(buildIssue(
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .APPLIED_EXECUTION_PLAN_FINGERPRINT_MISSING,
      'Runtime evidence requires the applied execution-plan artifact fingerprint.'
    ));
  } else if (!SHA256_FINGERPRINT_PATTERN.test(executionPlanArtifactFingerprint)) {
    issues.push(buildIssue(
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .APPLIED_EXECUTION_PLAN_FINGERPRINT_MALFORMED,
      'Applied execution-plan artifact fingerprint must be a SHA-256 digest.',
      { actualExecutionPlanArtifactFingerprint: executionPlanArtifactFingerprint }
    ));
  }

  const importScan = asObject(evidence.importScan);
  if (Object.keys(importScan).length > 0) {
    const importScanIssue = validateBinding({
      expectedFingerprint: reviewArtifactFingerprint,
      actualFingerprint: normalizeFingerprint(importScan.reviewArtifactFingerprint),
      missingRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .IMPORT_SCAN_REVIEW_BINDING_MISSING,
      mismatchRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .IMPORT_SCAN_REVIEW_BINDING_MISMATCH,
      messagePrefix: 'Import scan evidence',
    });
    if (importScanIssue) issues.push(importScanIssue);
  }

  asArray(evidence.runtimeChecks).forEach((check, index) => {
    const runtimeCheckIssue = validateBinding({
      expectedFingerprint: reviewArtifactFingerprint,
      actualFingerprint: normalizeFingerprint(check?.reviewArtifactFingerprint),
      missingRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .RUNTIME_CHECK_REVIEW_BINDING_MISSING,
      mismatchRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .RUNTIME_CHECK_REVIEW_BINDING_MISMATCH,
      messagePrefix: 'Runtime check evidence',
      metadata: {
        checkId: check?.checkId || null,
        index,
      },
    });
    if (runtimeCheckIssue) issues.push(runtimeCheckIssue);
  });

  const validationEvidence = asObject(evidence.validationEvidence);
  const focusedValidation = asObject(validationEvidence.focused);
  if (Object.keys(focusedValidation).length > 0) {
    const focusedValidationIssue = validateBinding({
      expectedFingerprint: reviewArtifactFingerprint,
      actualFingerprint: normalizeFingerprint(focusedValidation.reviewArtifactFingerprint),
      missingRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .FOCUSED_VALIDATION_REVIEW_BINDING_MISSING,
      mismatchRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .FOCUSED_VALIDATION_REVIEW_BINDING_MISMATCH,
      messagePrefix: 'Focused validation evidence',
    });
    if (focusedValidationIssue) issues.push(focusedValidationIssue);
  }

  const fullValidation = asObject(validationEvidence.full);
  if (Object.keys(fullValidation).length > 0) {
    const fullValidationIssue = validateBinding({
      expectedFingerprint: reviewArtifactFingerprint,
      actualFingerprint: normalizeFingerprint(fullValidation.reviewArtifactFingerprint),
      missingRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .FULL_VALIDATION_REVIEW_BINDING_MISSING,
      mismatchRiskId: POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .FULL_VALIDATION_REVIEW_BINDING_MISMATCH,
      messagePrefix: 'Full validation evidence',
    });
    if (fullValidationIssue) issues.push(fullValidationIssue);
  }

  return { reviewArtifactFingerprint, executionPlanArtifactFingerprint, issues };
}

function validatePolicyPostRemovalRuntimeEvidenceArtifact(
  runtimeEvidenceArtifact = null
) {
  const issues = [];

  if (
    !runtimeEvidenceArtifact ||
    typeof runtimeEvidenceArtifact !== 'object' ||
    Array.isArray(runtimeEvidenceArtifact)
  ) {
    return {
      ok: false,
      issueCount: 1,
      issues: [buildIssue(
        POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
          .MISSING_RUNTIME_EVIDENCE_ARTIFACT,
        'Post-removal verification requires a runtime evidence artifact.'
      )],
      reviewArtifactFingerprint: null,
      executionPlanArtifactFingerprint: null,
    };
  }

  const evidence = asObject(runtimeEvidenceArtifact.evidence);
  const expected = buildPolicyPostRemovalRuntimeEvidenceArtifact(evidence);
  const actualFingerprint = normalizeFingerprint(runtimeEvidenceArtifact.fingerprint);

  if (
    runtimeEvidenceArtifact.version !==
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION ||
    runtimeEvidenceArtifact.algorithm !== 'sha256' ||
    !SHA256_FINGERPRINT_PATTERN.test(actualFingerprint)
  ) {
    issues.push(buildIssue(
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .MALFORMED_RUNTIME_EVIDENCE_ARTIFACT,
      'Runtime evidence artifact must be a versioned SHA-256 artifact.'
    ));
  }

  if (actualFingerprint && actualFingerprint !== expected.fingerprint) {
    issues.push(buildIssue(
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .RUNTIME_EVIDENCE_ARTIFACT_MISMATCH,
      'Runtime evidence artifact fingerprint must match its exact evidence payload.',
      {
        expectedFingerprint: expected.fingerprint,
        actualFingerprint,
      }
    ));
  }

  const provenance = asObject(runtimeEvidenceArtifact.provenance);
  if (stableStringify(provenance) !== stableStringify(expected.provenance)) {
    issues.push(buildIssue(
      POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS
        .RUNTIME_EVIDENCE_PROVENANCE_MISMATCH,
      'Runtime evidence artifact provenance must match its evidence payload.'
    ));
  }

  const bindingEvaluation = validateEvidenceBindings(evidence);
  issues.push(...bindingEvaluation.issues);

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    reviewArtifactFingerprint: bindingEvaluation.reviewArtifactFingerprint,
    executionPlanArtifactFingerprint:
      bindingEvaluation.executionPlanArtifactFingerprint,
  };
}

export {
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_RISK_IDS,
  POLICY_POST_REMOVAL_RUNTIME_EVIDENCE_ARTIFACT_VERSION,
  buildPolicyPostRemovalRuntimeEvidenceArtifact,
  buildPolicyPostRemovalRuntimeEvidenceArtifactProjection,
  validatePolicyPostRemovalRuntimeEvidenceArtifact,
};
