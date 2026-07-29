/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_MIGRATION_PREVIEW_VERSION = 'policy.migration_preview.v1';

const POLICY_MIGRATION_PREVIEW_STATUS_IDS = Object.freeze({
  NO_MIGRATION_DIFFERENCES: 'no_migration_differences',
  REVIEW_REQUIRED: 'review_required',
  BLOCKED_BY_MIGRATION_RISK: 'blocked_by_migration_risk',
  INSUFFICIENT_REPRESENTATIVE_COVERAGE: 'insufficient_representative_coverage',
});

const POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS = Object.freeze({
  DESTINATION_CHANGE: 'destination_change',
  NEWLY_BLOCKED_ITEM: 'newly_blocked_item',
  NEWLY_REVIEW_REQUIRED_ITEM: 'newly_review_required_item',
  ROUTE_READINESS_CHANGE: 'route_readiness_change',
  EVIDENCE_CONFIDENCE_CHANGE: 'evidence_confidence_change',
});

const POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS = Object.freeze({
  INVALID_CONTRACT_VERSION: 'invalid_contract_version',
  PREVIEW_NOT_SERVER_OWNED: 'preview_not_server_owned',
  NORMAL_WORKFLOW_SURFACE: 'normal_workflow_surface',
  MISSING_REPRESENTATIVE_REQUIREMENT: 'missing_representative_requirement',
  INVALID_MAXIMUM_DIFFERENCES: 'invalid_maximum_differences',
  UNKNOWN_PREVIEW_STATUS: 'unknown_preview_status',
  UNKNOWN_DIFFERENCE_TYPE: 'unknown_difference_type',
  UNBOUNDED_DIFFERENCE_OUTPUT: 'unbounded_difference_output',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  INSUFFICIENT_COVERAGE_STATUS_MISMATCH: 'insufficient_coverage_status_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const DEFAULT_MAX_DIFFERENCES = 25;
const MAX_MAX_DIFFERENCES = 100;
const DEFAULT_CONFIDENCE_DELTA_THRESHOLD = 0.15;
const MIN_REPRESENTATIVE_CLASSIFICATIONS = 1;

const STATUS_IDS = Object.freeze(Object.values(POLICY_MIGRATION_PREVIEW_STATUS_IDS));
const DIFFERENCE_TYPE_IDS = Object.freeze(
  Object.values(POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS)
);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeConfidence(value) {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function normalizeClassificationId(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeMaxDifferences(value) {
  if (!Number.isFinite(Number(value))) return DEFAULT_MAX_DIFFERENCES;
  return Math.max(1, Math.min(MAX_MAX_DIFFERENCES, Math.trunc(Number(value))));
}

function normalizeConfidenceDeltaThreshold(value) {
  if (!Number.isFinite(Number(value))) return DEFAULT_CONFIDENCE_DELTA_THRESHOLD;
  return Math.max(0, Math.min(1, Number(value)));
}

function normalizePolicyMigrationPreviewOptions({
  maxDifferences,
  confidenceDeltaThreshold,
} = {}) {
  return {
    maxDifferences: normalizeMaxDifferences(maxDifferences),
    confidenceDeltaThreshold: normalizeConfidenceDeltaThreshold(confidenceDeltaThreshold),
  };
}

function normalizePolicyMigrationPreviewOutcome(value = {}) {
  const outcome = asObject(value);

  return {
    destinationLibraryId: outcome.destinationLibraryId ?? outcome.libraryId ?? null,
    destinationLibraryName: normalizeString(outcome.destinationLibraryName ?? outcome.libraryName),
    statusId: normalizeString(outcome.statusId ?? outcome.status),
    routeReady: normalizeBoolean(outcome.routeReady ?? outcome.routingReady),
    blocked: normalizeBoolean(outcome.blocked),
    needsReview: normalizeBoolean(outcome.needsReview ?? outcome.reviewRequired),
    confidenceScore: normalizeConfidence(outcome.confidenceScore ?? outcome.confidence),
    confidenceLevel: normalizeString(outcome.confidenceLevel),
  };
}

function normalizePolicyMigrationPreviewClassification(value = {}, generatedIntentDefault = {}) {
  const classification = asObject(value);
  const legacyOutcome = classification.legacyOutcome ?? classification.legacy;
  const generatedIntentOutcome = classification.generatedIntentOutcome ??
    classification.nativeIntentOutcome ??
    classification.generatedIntent ??
    classification.proposed;
  const normalizedLegacyOutcome = asObject(legacyOutcome);
  const normalizedGeneratedIntentOutcome = asObject(generatedIntentOutcome);
  const normalizedGeneratedIntentDefault = asObject(generatedIntentDefault);
  const itemId = normalizeClassificationId(
    classification.itemId ?? classification.classificationId ?? classification.id
  );
  const legacy = normalizePolicyMigrationPreviewOutcome(normalizedLegacyOutcome);
  const generatedIntent = normalizePolicyMigrationPreviewOutcome({
    ...normalizedGeneratedIntentDefault,
    ...normalizedGeneratedIntentOutcome,
  });
  const hasLegacyDestination = legacy.destinationLibraryId !== null ||
    Boolean(legacy.destinationLibraryName);
  const hasGeneratedIntentDestination = generatedIntent.destinationLibraryId !== null ||
    Boolean(generatedIntent.destinationLibraryName);

  return {
    itemId,
    title: normalizeString(classification.title ?? classification.name),
    year: classification.year ?? null,
    mediaType: normalizeString(classification.mediaType ?? classification.media_type),
    legacy,
    generatedIntent,
    hasLegacyBaseline: itemId !== null && hasLegacyDestination,
    hasGeneratedIntentOutcome: hasGeneratedIntentDestination,
    exposesRawPayload: Boolean(
      classification.exposesRawPayload === true ||
      classification.rawPayload ||
      classification.providerPayload ||
      classification.prompt ||
      classification.embedding
    ),
  };
}

function valuesDiffer(left, right) {
  return (left ?? null) !== (right ?? null);
}

function buildDifference({
  typeId,
  classification,
  summary,
  legacyValue,
  generatedIntentValue,
  severity = 'review',
}) {
  return {
    typeId,
    itemId: classification.itemId,
    title: classification.title,
    year: classification.year,
    mediaType: classification.mediaType,
    severity,
    summary,
    legacyValue,
    generatedIntentValue,
    exposesRawPayload: false,
  };
}

function comparePolicyMigrationPreviewClassification(classification, confidenceDeltaThreshold) {
  const differences = [];
  const legacyDestination = classification.legacy.destinationLibraryId ||
    classification.legacy.destinationLibraryName;
  const generatedIntentDestination = classification.generatedIntent.destinationLibraryId ||
    classification.generatedIntent.destinationLibraryName;

  if (valuesDiffer(legacyDestination, generatedIntentDestination)) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE,
      classification,
      summary: 'Generated intent would choose a different destination than legacy behavior.',
      legacyValue: legacyDestination,
      generatedIntentValue: generatedIntentDestination,
    }));
  }

  if (classification.legacy.blocked !== true && classification.generatedIntent.blocked === true) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM,
      classification,
      severity: 'blocker',
      summary: 'Generated intent would newly block an item legacy behavior did not block.',
      legacyValue: classification.legacy.statusId || 'not_blocked',
      generatedIntentValue: classification.generatedIntent.statusId || 'blocked',
    }));
  }

  if (classification.legacy.needsReview !== true && classification.generatedIntent.needsReview === true) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.NEWLY_REVIEW_REQUIRED_ITEM,
      classification,
      summary: 'Generated intent would require review for an item legacy behavior allowed.',
      legacyValue: classification.legacy.statusId || 'no_review',
      generatedIntentValue: classification.generatedIntent.statusId || 'review_required',
    }));
  }

  if (classification.legacy.routeReady !== classification.generatedIntent.routeReady) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.ROUTE_READINESS_CHANGE,
      classification,
      summary: 'Generated intent changes route readiness compared with legacy behavior.',
      legacyValue: classification.legacy.routeReady,
      generatedIntentValue: classification.generatedIntent.routeReady,
    }));
  }

  const legacyConfidence = classification.legacy.confidenceScore;
  const generatedIntentConfidence = classification.generatedIntent.confidenceScore;
  const confidenceDelta = legacyConfidence !== null && generatedIntentConfidence !== null
    ? Math.abs(legacyConfidence - generatedIntentConfidence)
    : 0;
  const confidenceLevelsAreComparable = Boolean(
    classification.legacy.confidenceLevel && classification.generatedIntent.confidenceLevel
  );
  if (confidenceDelta >= confidenceDeltaThreshold ||
      (confidenceLevelsAreComparable && valuesDiffer(
        classification.legacy.confidenceLevel,
        classification.generatedIntent.confidenceLevel
      ))) {
    differences.push(buildDifference({
      typeId: POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.EVIDENCE_CONFIDENCE_CHANGE,
      classification,
      summary: 'Generated intent changes evidence confidence compared with legacy behavior.',
      legacyValue: classification.legacy.confidenceLevel || legacyConfidence,
      generatedIntentValue: classification.generatedIntent.confidenceLevel || generatedIntentConfidence,
    }));
  }

  return differences;
}

function summarizePolicyMigrationPreviewDifferences(differences = []) {
  return Object.fromEntries(
    DIFFERENCE_TYPE_IDS.map(typeId => [
      typeId,
      asArray(differences).filter(difference => difference.typeId === typeId).length,
    ])
  );
}

function determinePreviewStatus({ classifications, differences }) {
  if (classifications.length < MIN_REPRESENTATIVE_CLASSIFICATIONS) {
    return POLICY_MIGRATION_PREVIEW_STATUS_IDS.INSUFFICIENT_REPRESENTATIVE_COVERAGE;
  }

  if (differences.some(difference =>
    difference.typeId === POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.NEWLY_BLOCKED_ITEM
  )) {
    return POLICY_MIGRATION_PREVIEW_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK;
  }

  if (differences.length > 0) {
    return POLICY_MIGRATION_PREVIEW_STATUS_IDS.REVIEW_REQUIRED;
  }

  return POLICY_MIGRATION_PREVIEW_STATUS_IDS.NO_MIGRATION_DIFFERENCES;
}

function buildPolicyMigrationPreviewContract() {
  return {
    version: POLICY_MIGRATION_PREVIEW_VERSION,
    serverOwned: true,
    normalWorkflowSurface: false,
    representativeClassificationsRequired: true,
    minimumRepresentativeClassifications: MIN_REPRESENTATIVE_CLASSIFICATIONS,
    maximumEmittedDifferences: MAX_MAX_DIFFERENCES,
    sideEffectsAllowed: false,
  };
}

function validatePolicyMigrationPreviewContract(contract = {}) {
  const normalized = asObject(contract);
  const issues = [];

  if (normalized.version !== POLICY_MIGRATION_PREVIEW_VERSION) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.INVALID_CONTRACT_VERSION,
      message: 'Migration preview contract must use the supported version.',
    });
  }

  if (normalized.serverOwned !== true) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.PREVIEW_NOT_SERVER_OWNED,
      message: 'Migration preview must remain server-owned.',
    });
  }

  if (normalized.normalWorkflowSurface !== false) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
      message: 'Migration preview cannot be a normal policy workflow surface.',
    });
  }

  if (normalized.representativeClassificationsRequired !== true ||
      Number(normalized.minimumRepresentativeClassifications) <
        MIN_REPRESENTATIVE_CLASSIFICATIONS) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.MISSING_REPRESENTATIVE_REQUIREMENT,
      message: 'Migration preview must require representative classifications.',
    });
  }

  if (Number(normalized.maximumEmittedDifferences) < 1 ||
      Number(normalized.maximumEmittedDifferences) > MAX_MAX_DIFFERENCES) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.INVALID_MAXIMUM_DIFFERENCES,
      message: 'Migration preview must use a bounded emitted-difference maximum.',
    });
  }

  if (normalized.sideEffectsAllowed !== false) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Migration preview cannot allow side effects.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyMigrationPreview({
  representativeClassifications = [],
  generatedIntentDefault = {},
  maxDifferences,
  confidenceDeltaThreshold,
} = {}) {
  const options = normalizePolicyMigrationPreviewOptions({
    maxDifferences,
    confidenceDeltaThreshold,
  });
  const classifications = asArray(representativeClassifications)
    .map(classification => normalizePolicyMigrationPreviewClassification(
      classification,
      generatedIntentDefault
    ));
  const comparableClassifications = classifications.filter(classification =>
    classification.hasLegacyBaseline === true &&
    classification.hasGeneratedIntentOutcome === true
  );
  const allDifferences = comparableClassifications.flatMap(classification =>
    comparePolicyMigrationPreviewClassification(classification, options.confidenceDeltaThreshold)
  );
  const differences = allDifferences.slice(0, options.maxDifferences);
  const statusId = determinePreviewStatus({
    classifications: comparableClassifications,
    differences: allDifferences,
  });

  return {
    version: POLICY_MIGRATION_PREVIEW_VERSION,
    statusId,
    representativeSummary: {
      receivedCount: classifications.length,
      comparedCount: comparableClassifications.length,
      unusableCount: classifications.length - comparableClassifications.length,
      minimumRequired: MIN_REPRESENTATIVE_CLASSIFICATIONS,
      coverageSufficient:
        comparableClassifications.length >= MIN_REPRESENTATIVE_CLASSIFICATIONS,
      rawPayloadSuppressed: classifications.some(classification =>
        classification.exposesRawPayload === true
      ),
    },
    differenceSummary: {
      totalCount: allDifferences.length,
      emittedCount: differences.length,
      truncated: allDifferences.length > differences.length,
      byType: summarizePolicyMigrationPreviewDifferences(allDifferences),
    },
    differences,
    normalWorkflowSurface: false,
    sideEffects: {
      policyActivated: false,
      policyReplaced: false,
      policyDeleted: false,
      learningWritten: false,
      routingWritten: false,
      rollbackCreated: false,
    },
  };
}

function validatePolicyMigrationPreview(preview = {}) {
  const normalized = asObject(preview);
  const issues = [];
  const differences = asArray(normalized.differences);
  const summary = asObject(normalized.differenceSummary);
  const representativeSummary = asObject(normalized.representativeSummary);

  if (normalized.version !== POLICY_MIGRATION_PREVIEW_VERSION) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.INVALID_CONTRACT_VERSION,
      message: 'Migration preview must use the supported version.',
    });
  }

  if (!STATUS_IDS.includes(normalized.statusId)) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.UNKNOWN_PREVIEW_STATUS,
      message: 'Migration preview must use a supported status.',
    });
  }

  differences.forEach(difference => {
    if (!DIFFERENCE_TYPE_IDS.includes(difference?.typeId)) {
      issues.push({
        riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.UNKNOWN_DIFFERENCE_TYPE,
        message: 'Migration preview emitted an unsupported difference type.',
      });
    }

    if (difference?.exposesRawPayload === true || difference?.rawPayload ||
        difference?.providerPayload || difference?.prompt || difference?.embedding) {
      issues.push({
        riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
        message: 'Migration preview cannot expose raw provider, prompt, or embedding payloads.',
      });
    }
  });

  if (Number(summary.emittedCount) !== differences.length ||
      Number(summary.emittedCount) > Number(summary.totalCount) ||
      differences.length > MAX_MAX_DIFFERENCES) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.UNBOUNDED_DIFFERENCE_OUTPUT,
      message: 'Migration preview differences must be bounded and counted.',
    });
  }

  const coverageSufficient = representativeSummary.coverageSufficient === true;
  const comparedCount = Number(representativeSummary.comparedCount);
  const receivedCount = Number(representativeSummary.receivedCount);
  const unusableCount = Number(representativeSummary.unusableCount);
  if (
    !Number.isInteger(receivedCount) ||
    !Number.isInteger(comparedCount) ||
    !Number.isInteger(unusableCount) ||
    receivedCount !== comparedCount + unusableCount ||
    coverageSufficient !== (comparedCount >= MIN_REPRESENTATIVE_CLASSIFICATIONS) ||
    (coverageSufficient &&
      normalized.statusId === POLICY_MIGRATION_PREVIEW_STATUS_IDS.INSUFFICIENT_REPRESENTATIVE_COVERAGE) ||
    (!coverageSufficient &&
      normalized.statusId !== POLICY_MIGRATION_PREVIEW_STATUS_IDS.INSUFFICIENT_REPRESENTATIVE_COVERAGE)
  ) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.INSUFFICIENT_COVERAGE_STATUS_MISMATCH,
      message: 'Migration preview coverage and status must agree.',
    });
  }

  if (normalized.normalWorkflowSurface !== false) {
    issues.push({
      riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.NORMAL_WORKFLOW_SURFACE,
      message: 'Migration preview cannot become a normal policy workflow surface.',
    });
  }

  Object.entries(asObject(normalized.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Migration preview cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  DEFAULT_CONFIDENCE_DELTA_THRESHOLD,
  DEFAULT_MAX_DIFFERENCES,
  MAX_MAX_DIFFERENCES,
  MIN_REPRESENTATIVE_CLASSIFICATIONS,
  POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS,
  POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS,
  POLICY_MIGRATION_PREVIEW_STATUS_IDS,
  POLICY_MIGRATION_PREVIEW_VERSION,
  buildPolicyMigrationPreview,
  buildPolicyMigrationPreviewContract,
  normalizePolicyMigrationPreviewClassification,
  normalizePolicyMigrationPreviewOptions,
  validatePolicyMigrationPreview,
  validatePolicyMigrationPreviewContract,
};
