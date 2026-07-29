/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  buildPolicyMigrationGeneratedIntentOutcome,
} from './policyMigrationGeneratedIntentOutcome.mjs';
import {
  validatePolicyLibraryPolicyRebuildProposal,
} from './policyLibraryPolicyRebuild.mjs';

const POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_VERSION =
  'policy.migration_representative_classification_source.v1';

const POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INSUFFICIENT_REPRESENTATIVE_COVERAGE: 'insufficient_representative_coverage',
  INVALID_POLICY_CONTEXT: 'invalid_policy_context',
  INVALID_REBUILD_PROPOSAL: 'invalid_rebuild_proposal',
  POLICY_CONTEXT_UNAVAILABLE: 'policy_context_unavailable',
  PROPOSAL_CONTEXT_MISMATCH: 'proposal_context_mismatch',
  COLLECTION_FAILED: 'collection_failed',
});

const POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS = Object.freeze({
  INVALID_POLICY_CONTEXT: 'invalid_policy_context',
  INVALID_REBUILD_PROPOSAL: 'invalid_rebuild_proposal',
  POLICY_CONTEXT_UNAVAILABLE: 'policy_context_unavailable',
  PROPOSAL_CONTEXT_MISMATCH: 'proposal_context_mismatch',
  COLLECTION_FAILED: 'collection_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  SUMMARY_COUNT_MISMATCH: 'summary_count_mismatch',
  STATUS_MISMATCH: 'status_mismatch',
  SOURCE_PROVENANCE_MISMATCH: 'source_provenance_mismatch',
  UNSAFE_REPRESENTATIVE_CLASSIFICATION: 'unsafe_representative_classification',
  RAW_DATA_EXPOSED: 'raw_data_exposed',
});

const FINAL_CLASSIFICATION_STATUS_IDS = Object.freeze([
  'completed',
  'corrected',
  'verified',
  'reclassified',
  'routed',
]);

const DEFAULT_MAX_REPRESENTATIVE_CLASSIFICATIONS = 25;
const MAX_REPRESENTATIVE_CLASSIFICATIONS = 100;
const SOURCE_ID = 'persisted_destination_library_final_outcomes';
const DETERMINISTIC_ORDER_ID = 'created_at_desc_id_desc';

const POLICY_CONTEXT_SQL = `
  SELECT
    policy.id AS policy_id,
    policy.library_id,
    library.name AS library_name,
    library.media_type,
    library.is_active AS library_active
  FROM library_policies policy
  JOIN libraries library ON library.id = policy.library_id
  WHERE policy.id = $1
    AND policy.library_id = $2
  LIMIT 1
`;

const REPRESENTATIVE_CLASSIFICATIONS_SQL = `
  SELECT
    classification.id,
    classification.media_type,
    classification.library_id,
    classification.status,
    classification.confidence
  FROM classification_history classification
  WHERE classification.library_id = $1
    AND classification.media_type = $2
    AND classification.status = ANY($3::text[])
  ORDER BY classification.created_at DESC, classification.id DESC
  LIMIT $4
`;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeString(value, maximumLength = 255) {
  return typeof value === 'string'
    ? value.trim().slice(0, maximumLength)
    : '';
}

function normalizeMediaType(value) {
  const mediaType = normalizeString(value, 20).toLowerCase();
  return ['movie', 'tv'].includes(mediaType) ? mediaType : null;
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1
    ? Math.max(0, Math.min(1, numeric / 100))
    : Math.max(0, Math.min(1, numeric));
}

function normalizeMaximumClassifications(value) {
  if (!Number.isFinite(Number(value))) return DEFAULT_MAX_REPRESENTATIVE_CLASSIFICATIONS;
  return Math.max(1, Math.min(MAX_REPRESENTATIVE_CLASSIFICATIONS, Math.trunc(Number(value))));
}

function normalizePolicyContext(value = {}) {
  const context = asObject(value);

  return {
    policyId: normalizePositiveInteger(context.policyId ?? context.policy_id),
    libraryId: normalizePositiveInteger(context.libraryId ?? context.library_id),
  };
}

function normalizePersistedPolicyContext(row = {}) {
  const source = asObject(row);

  return {
    policyId: normalizePositiveInteger(source.policy_id ?? source.policyId),
    libraryId: normalizePositiveInteger(source.library_id ?? source.libraryId),
    libraryName: normalizeString(source.library_name ?? source.libraryName) || null,
    mediaType: normalizeMediaType(source.media_type ?? source.mediaType),
    libraryActive: source.library_active === true || source.libraryActive === true,
  };
}

function proposalMatchesPolicyContext({ proposal = {}, policyContext = {} } = {}) {
  const library = asObject(proposal.library);

  return (
    normalizePositiveInteger(library.libraryId) === policyContext.libraryId &&
    normalizeString(library.libraryName) === policyContext.libraryName &&
    normalizeMediaType(library.mediaType) === policyContext.mediaType
  );
}

function buildRepresentativeClassification({ row = {}, policyContext = {}, generatedIntentOutcome = {} } = {}) {
  const source = asObject(row);
  const itemId = normalizePositiveInteger(source.id);
  const mediaType = normalizeMediaType(source.media_type ?? source.mediaType);
  const destinationLibraryId = normalizePositiveInteger(source.library_id ?? source.libraryId);
  const statusId = normalizeString(source.status, 40).toLowerCase();

  if (!itemId ||
      destinationLibraryId !== policyContext.libraryId ||
      mediaType !== policyContext.mediaType ||
      !FINAL_CLASSIFICATION_STATUS_IDS.includes(statusId)) {
    return null;
  }

  return {
    itemId,
    mediaType,
    legacyOutcome: {
      destinationLibraryId,
      destinationLibraryName: policyContext.libraryName,
      statusId,
      routeReady: statusId === 'routed',
      blocked: false,
      needsReview: false,
      confidenceScore: normalizeConfidence(source.confidence),
    },
    generatedIntentOutcome,
  };
}

function buildSideEffects({ databaseRead = false } = {}) {
  return {
    databaseRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    classificationStorageMutated: false,
    routingWritten: false,
  };
}

function buildResult({
  statusId,
  ok,
  policyContext = null,
  representativeClassifications = [],
  maximumClassifications = DEFAULT_MAX_REPRESENTATIVE_CLASSIFICATIONS,
  sourceRowsRead = 0,
  sourceRowsConsidered = 0,
  sourceRowsTruncated = false,
  databaseRead = false,
  issue = null,
} = {}) {
  const classifications = asArray(representativeClassifications);
  const issues = issue ? [issue] : [];
  const coverageSufficient = classifications.length > 0;

  return {
    version: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_VERSION,
    ok,
    ready: ok === true && coverageSufficient,
    statusId,
    policyContext,
    representativeClassifications: classifications,
    sourceProvenance: policyContext
      ? {
          sourceId: SOURCE_ID,
          policyId: policyContext.policyId,
          libraryId: policyContext.libraryId,
          mediaType: policyContext.mediaType,
          deterministicOrderId: DETERMINISTIC_ORDER_ID,
        }
      : null,
    summary: {
      maximumClassifications,
      sourceRowsRead,
      sourceRowsConsidered,
      representativeClassificationCount: classifications.length,
      unusableSourceRowCount: sourceRowsConsidered - classifications.length,
      sourceRowsTruncated,
      coverageSufficient,
    },
    issueCount: issues.length,
    issues,
    sideEffects: buildSideEffects({ databaseRead }),
  };
}

function buildIssue(riskId, message) {
  return { riskId, message };
}

function createPolicyMigrationRepresentativeClassificationSource({ db = defaultDb } = {}) {
  async function collectRepresentativeClassifications({
    policyContext = {},
    proposal = {},
    maxClassifications,
  } = {}) {
    const normalizedPolicyContext = normalizePolicyContext(policyContext);
    const maximumClassifications = normalizeMaximumClassifications(maxClassifications);

    if (!normalizedPolicyContext.policyId || !normalizedPolicyContext.libraryId) {
      return buildResult({
        statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.INVALID_POLICY_CONTEXT,
        ok: false,
        maximumClassifications,
        issue: buildIssue(
          POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.INVALID_POLICY_CONTEXT,
          'Representative classification collection requires a positive policy and library ID.',
        ),
      });
    }

    if (!validatePolicyLibraryPolicyRebuildProposal(proposal).ok) {
      return buildResult({
        statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.INVALID_REBUILD_PROPOSAL,
        ok: false,
        maximumClassifications,
        issue: buildIssue(
          POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.INVALID_REBUILD_PROPOSAL,
          'Representative classification collection requires a valid rebuild proposal.',
        ),
      });
    }

    if (!db || typeof db.query !== 'function') {
      return buildResult({
        statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        maximumClassifications,
        issue: buildIssue(
          POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.COLLECTION_FAILED,
          'Representative classifications could not be collected.',
        ),
      });
    }

    try {
      const contextResult = await db.query(POLICY_CONTEXT_SQL, [
        normalizedPolicyContext.policyId,
        normalizedPolicyContext.libraryId,
      ]);
      const persistedPolicyContext = normalizePersistedPolicyContext(
        asArray(contextResult?.rows)[0]
      );

      if (!persistedPolicyContext.policyId ||
          !persistedPolicyContext.libraryId ||
          !persistedPolicyContext.libraryName ||
          !persistedPolicyContext.mediaType ||
          persistedPolicyContext.libraryActive !== true) {
        return buildResult({
          statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.POLICY_CONTEXT_UNAVAILABLE,
          ok: false,
          maximumClassifications,
          databaseRead: true,
          issue: buildIssue(
            POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.POLICY_CONTEXT_UNAVAILABLE,
            'Representative classification collection requires an active persisted policy library.',
          ),
        });
      }

      if (!proposalMatchesPolicyContext({ proposal, policyContext: persistedPolicyContext })) {
        return buildResult({
          statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.PROPOSAL_CONTEXT_MISMATCH,
          ok: false,
          policyContext: persistedPolicyContext,
          maximumClassifications,
          databaseRead: true,
          issue: buildIssue(
            POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.PROPOSAL_CONTEXT_MISMATCH,
            'Representative classification collection requires a rebuild proposal for the persisted policy library.',
          ),
        });
      }

      const sourceResult = await db.query(REPRESENTATIVE_CLASSIFICATIONS_SQL, [
        persistedPolicyContext.libraryId,
        persistedPolicyContext.mediaType,
        FINAL_CLASSIFICATION_STATUS_IDS,
        maximumClassifications + 1,
      ]);
      const sourceRows = asArray(sourceResult?.rows);
      const selectedRows = sourceRows.slice(0, maximumClassifications);
      const generatedIntentOutcome = buildPolicyMigrationGeneratedIntentOutcome(proposal);
      const representativeClassifications = selectedRows
        .map(row => buildRepresentativeClassification({
          row,
          policyContext: persistedPolicyContext,
          generatedIntentOutcome,
        }))
        .filter(Boolean);
      const coverageSufficient = representativeClassifications.length > 0;

      return buildResult({
        statusId: coverageSufficient
          ? POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.READY
          : POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS
            .INSUFFICIENT_REPRESENTATIVE_COVERAGE,
        ok: true,
        policyContext: persistedPolicyContext,
        representativeClassifications,
        maximumClassifications,
        sourceRowsRead: sourceRows.length,
        sourceRowsConsidered: selectedRows.length,
        sourceRowsTruncated: sourceRows.length > maximumClassifications,
        databaseRead: true,
      });
    } catch {
      return buildResult({
        statusId: POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.COLLECTION_FAILED,
        ok: false,
        maximumClassifications,
        databaseRead: true,
        issue: buildIssue(
          POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.COLLECTION_FAILED,
          'Representative classifications could not be collected.',
        ),
      });
    }
  }

  return {
    collectRepresentativeClassifications,
  };
}

function buildPolicyMigrationRepresentativeClassificationSourceAudit(result = {}) {
  const source = asObject(result);
  const policyContext = asObject(source.policyContext);
  const sourceProvenance = asObject(source.sourceProvenance);
  const summary = asObject(source.summary);
  const classifications = asArray(source.representativeClassifications);
  const issues = [];
  const expectedCoverageSufficient = classifications.length > 0;
  const allowedStatuses = Object.values(
    POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS
  );

  if (source.version !== POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_VERSION ||
      !allowedStatuses.includes(source.statusId)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.STATUS_MISMATCH,
      'Representative classification source must use a supported version and status.',
    ));
  }

  if (source.statusId === POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.READY &&
      (source.ok !== true || source.ready !== true || expectedCoverageSufficient !== true)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.STATUS_MISMATCH,
      'Ready representative classification output requires usable coverage.',
    ));
  }

  if (source.statusId !== POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS.READY &&
      source.statusId !== POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS
        .INSUFFICIENT_REPRESENTATIVE_COVERAGE &&
      (source.ok !== false || source.ready !== false)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.STATUS_MISMATCH,
      'Failed representative classification output cannot be marked successful or ready.',
    ));
  }

  if (source.statusId ===
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS
        .INSUFFICIENT_REPRESENTATIVE_COVERAGE &&
      (source.ok !== true || source.ready !== false || expectedCoverageSufficient !== false)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.STATUS_MISMATCH,
      'Insufficient representative coverage cannot be marked ready.',
    ));
  }

  if (source.ok === true &&
      (!normalizePositiveInteger(policyContext.policyId) ||
        !normalizePositiveInteger(policyContext.libraryId) ||
        !policyContext.libraryName ||
        !normalizeMediaType(policyContext.mediaType) ||
        policyContext.libraryActive !== true)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.POLICY_CONTEXT_UNAVAILABLE,
      'Successful representative classification output requires persisted policy context.',
    ));
  }

  if (source.ok === true &&
      (sourceProvenance.sourceId !== SOURCE_ID ||
        normalizePositiveInteger(sourceProvenance.policyId) !== policyContext.policyId ||
        normalizePositiveInteger(sourceProvenance.libraryId) !== policyContext.libraryId ||
        normalizeMediaType(sourceProvenance.mediaType) !== policyContext.mediaType ||
        sourceProvenance.deterministicOrderId !== DETERMINISTIC_ORDER_ID)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.SOURCE_PROVENANCE_MISMATCH,
      'Representative classification provenance must match the persisted policy context.',
    ));
  }

  if (Number(summary.representativeClassificationCount) !== classifications.length ||
      !Number.isInteger(summary.sourceRowsRead) ||
      !Number.isInteger(summary.sourceRowsConsidered) ||
      !Number.isInteger(summary.unusableSourceRowCount) ||
      Number(summary.sourceRowsRead) < Number(summary.sourceRowsConsidered) ||
      Number(summary.sourceRowsRead) > Number(summary.maximumClassifications) + 1 ||
      Number(summary.sourceRowsConsidered) < classifications.length ||
      Number(summary.unusableSourceRowCount) !==
        Number(summary.sourceRowsConsidered) - classifications.length ||
      summary.coverageSufficient !== expectedCoverageSufficient ||
      Number(summary.maximumClassifications) < 1 ||
      Number(summary.maximumClassifications) > MAX_REPRESENTATIVE_CLASSIFICATIONS ||
      classifications.length > Number(summary.maximumClassifications)) {
    issues.push(buildIssue(
      POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      'Representative classification source summary must match its bounded output.',
    ));
  }

  classifications.forEach(classification => {
    const representativeClassification = asObject(classification);
    const legacyOutcome = asObject(representativeClassification.legacyOutcome);
    const generatedIntentOutcome = asObject(representativeClassification.generatedIntentOutcome);
    const rawDataPresent = [
      'title',
      'year',
      'metadata',
      'rawPayload',
      'providerPayload',
      'prompt',
      'embedding',
    ].some(key => Object.hasOwn(representativeClassification, key));

    if (!normalizePositiveInteger(representativeClassification.itemId) ||
        normalizeMediaType(representativeClassification.mediaType) !== policyContext.mediaType ||
        normalizePositiveInteger(legacyOutcome.destinationLibraryId) !== policyContext.libraryId ||
        normalizePositiveInteger(generatedIntentOutcome.destinationLibraryId) !==
          policyContext.libraryId) {
      issues.push(buildIssue(
        POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS
          .UNSAFE_REPRESENTATIVE_CLASSIFICATION,
        'Representative classifications must remain scoped to the persisted policy library.',
      ));
    }

    if (rawDataPresent) {
      issues.push(buildIssue(
        POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.RAW_DATA_EXPOSED,
        'Representative classifications cannot expose raw source data.',
      ));
    }
  });

  Object.entries(asObject(source.sideEffects)).forEach(([key, value]) => {
    if (key !== 'databaseRead' && value === true) {
      issues.push(buildIssue(
        POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS.UNSAFE_SIDE_EFFECT,
        `Representative classification source cannot perform side effect "${key}".`,
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  DEFAULT_MAX_REPRESENTATIVE_CLASSIFICATIONS,
  DETERMINISTIC_ORDER_ID,
  FINAL_CLASSIFICATION_STATUS_IDS,
  MAX_REPRESENTATIVE_CLASSIFICATIONS,
  POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_RISK_IDS,
  POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_STATUS_IDS,
  POLICY_MIGRATION_REPRESENTATIVE_CLASSIFICATION_SOURCE_VERSION,
  SOURCE_ID,
  buildPolicyMigrationRepresentativeClassificationSourceAudit,
  createPolicyMigrationRepresentativeClassificationSource,
};
