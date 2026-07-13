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

const POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_AUDIT_VERSION =
  'policy.delivery_term_removal_completion_audit.v1';

const POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED: 'blocked',
});

const POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS = Object.freeze({
  PRODUCTION_DELIVERY_TERM_FOUND: 'production_delivery_term_found',
  MAINTENANCE_PARSER_IMPORTED_BY_PRODUCTION: 'maintenance_parser_imported_by_production',
  COMPATIBILITY_BOUNDARY_INVALID: 'compatibility_boundary_invalid',
  COMPATIBILITY_READER_SOURCE_MISSING: 'compatibility_reader_source_missing',
  COMPATIBILITY_READER_OWNER_MISSING: 'compatibility_reader_owner_missing',
  COMPATIBILITY_READER_REMOVAL_CONDITION_MISSING:
    'compatibility_reader_removal_condition_missing',
  COMPATIBILITY_READER_DELETION_TEST_MISSING:
    'compatibility_reader_deletion_test_missing',
  COMPATIBILITY_READER_DELETION_TEST_NOT_FOUND:
    'compatibility_reader_deletion_test_not_found',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRepoPath(value) {
  return normalizeString(value).replaceAll('\\', '/').replace(/^\/+/, '');
}

function buildProductionDeliveryTermRisks(productionMatches) {
  return asArray(productionMatches).map(match => {
    const normalizedMatch = asObject(match);

    return {
      riskId: POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS.PRODUCTION_DELIVERY_TERM_FOUND,
      repoPath: normalizeRepoPath(normalizedMatch.repoPath),
      lineNumber: Number.isInteger(normalizedMatch.lineNumber)
        ? normalizedMatch.lineNumber
        : null,
      matcherId: normalizeString(normalizedMatch.matcherId),
      token: normalizeString(normalizedMatch.token),
      message: 'Production source cannot retain delivery-term identifiers.',
    };
  });
}

function buildMaintenanceImportRisks(maintenanceImports) {
  return asArray(maintenanceImports).map(importRecord => {
    const normalizedImport = asObject(importRecord);

    return {
      riskId:
        POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS.MAINTENANCE_PARSER_IMPORTED_BY_PRODUCTION,
      repoPath: normalizeRepoPath(normalizedImport.repoPath),
      lineNumber: Number.isInteger(normalizedImport.lineNumber)
        ? normalizedImport.lineNumber
        : null,
      parserPath: normalizeRepoPath(normalizedImport.parserPath),
      message: 'Production source cannot import delivery-term maintenance parsers.',
    };
  });
}

function buildCompatibilityReaderRisks({
  compatibilityModuleRecords,
  availableProductionPaths,
  availableTestPaths,
}) {
  const productionPaths = new Set(asArray(availableProductionPaths).map(normalizeRepoPath));
  const testPaths = new Set(asArray(availableTestPaths).map(normalizeRepoPath));

  return asArray(compatibilityModuleRecords).flatMap(record => {
    const normalizedRecord = asObject(record);
    const moduleId = normalizeString(normalizedRecord.id);
    const repoPath = normalizeRepoPath(normalizedRecord.path);
    const deletionTestPath = normalizeRepoPath(normalizedRecord.deletionTestPath);
    const risks = [];

    if (!productionPaths.has(repoPath)) {
      risks.push({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS.COMPATIBILITY_READER_SOURCE_MISSING,
        moduleId,
        repoPath,
        message: 'Declared compatibility reader source is not present in production source roots.',
      });
    }

    if (!normalizeString(normalizedRecord.ownerId)) {
      risks.push({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS.COMPATIBILITY_READER_OWNER_MISSING,
        moduleId,
        repoPath,
        message: 'Compatibility reader must have an explicit owner.',
      });
    }

    if (!normalizeString(normalizedRecord.removalConditionId)) {
      risks.push({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_READER_REMOVAL_CONDITION_MISSING,
        moduleId,
        repoPath,
        message: 'Compatibility reader must declare its removal condition.',
      });
    }

    if (!deletionTestPath) {
      risks.push({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_READER_DELETION_TEST_MISSING,
        moduleId,
        repoPath,
        message: 'Compatibility reader must declare deletion-test coverage.',
      });
    } else if (!testPaths.has(deletionTestPath)) {
      risks.push({
        riskId:
          POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS
            .COMPATIBILITY_READER_DELETION_TEST_NOT_FOUND,
        moduleId,
        repoPath,
        deletionTestPath,
        message: 'Declared compatibility deletion test is not present in test source roots.',
      });
    }

    return risks;
  });
}

function buildPolicyDeliveryTermRemovalCompletionAudit({
  productionMatches = [],
  maintenanceImports = [],
  compatibilityBoundaryAudit = {},
  compatibilityModuleRecords = [],
  availableProductionPaths = [],
  availableTestPaths = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const boundaryAudit = asObject(compatibilityBoundaryAudit);
  const risks = [
    ...buildProductionDeliveryTermRisks(productionMatches),
    ...buildMaintenanceImportRisks(maintenanceImports),
    ...buildCompatibilityReaderRisks({
      compatibilityModuleRecords,
      availableProductionPaths,
      availableTestPaths,
    }),
  ];

  if (boundaryAudit.ok !== true) {
    risks.push({
      riskId: POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS.COMPATIBILITY_BOUNDARY_INVALID,
      boundaryIssueCount: asArray(boundaryAudit.issues).length,
      message: 'Compatibility boundary validation must pass before delivery-term removal is complete.',
    });
  }

  const sideEffects = {
    filesRead: false,
    filesWritten: false,
    storageChanged: false,
    gitCommandsRun: false,
    commandsExecuted: false,
  };

  const reportedSideEffects = Object.entries(sideEffects)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  if (reportedSideEffects.length > 0) {
    risks.push({
      riskId: POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS.SIDE_EFFECT_REPORTED,
      reportedSideEffects,
      message: 'Completion audit must remain side-effect free.',
    });
  }

  const complete = risks.length === 0;

  return {
    version: POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_AUDIT_VERSION,
    generatedAt,
    statusId: complete
      ? POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_STATUS_IDS.COMPLETE
      : POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_STATUS_IDS.BLOCKED,
    complete,
    summary: {
      productionMatchCount: asArray(productionMatches).length,
      maintenanceImportCount: asArray(maintenanceImports).length,
      compatibilityReaderCount: asArray(compatibilityModuleRecords).length,
      compatibilityBoundaryIssueCount: asArray(boundaryAudit.issues).length,
      riskCount: risks.length,
    },
    risks,
    sideEffects,
    nextAction: complete
      ? {
        id: 'continue_native_storage_cutover_verification',
        label: 'Continue native storage cutover verification',
        reason: 'Production terminology and compatibility-reader boundaries meet the removal gate.',
      }
      : {
        id: 'remove_delivery_terms_or_bound_compatibility',
        label: 'Remove delivery terms or bound compatibility readers',
        reason: 'Production terminology or compatibility-reader removal evidence remains incomplete.',
      },
  };
}

export {
  POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_AUDIT_VERSION,
  POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_RISK_IDS,
  POLICY_DELIVERY_TERM_REMOVAL_COMPLETION_STATUS_IDS,
  buildPolicyDeliveryTermRemovalCompletionAudit,
};
