/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionActions.mjs';

const POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS = Object.freeze({
  FILE_PATH: 'file_path',
  NAMED_TEST_SCOPE: 'named_test_scope',
});

const POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS = Object.freeze({
  ACTION_UNKNOWN: 'action_unknown',
  PATH_MISSING: 'path_missing',
  SOURCE_FRAGMENT_MISSING: 'source_fragment_missing',
  TEST_NAME_FRAGMENT_MISSING: 'test_name_fragment_missing',
  WHOLE_FILE_DELETION_ALLOWED: 'whole_file_deletion_allowed',
  FILE_ENTRY_SCOPE_PRESENT: 'file_entry_scope_present',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).map(cleanString).filter(Boolean))].sort();
}

function isPolicyCompatibilityDeletionNamedTestScopeEntry(entry = {}) {
  return entry.actionId ===
    POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE;
}

function normalizePolicyCompatibilityDeletionExecutionManifestEntry(entry = {}) {
  const actionId = cleanString(entry.actionId);
  const namedTestScope = actionId ===
    POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE;

  return {
    kindId: namedTestScope
      ? POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS.NAMED_TEST_SCOPE
      : POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS.FILE_PATH,
    actionId,
    categoryId: cleanString(entry.categoryId) || null,
    path: cleanString(entry.path),
    targetKindId: cleanString(entry.targetKindId) || null,
    dependencyIds: uniqueStrings(entry.dependencyIds),
    sourceTextFragments: uniqueStrings(entry.sourceTextFragments),
    testNameFragments: uniqueStrings(entry.testNameFragments),
    componentPath: cleanString(entry.componentPath) || null,
    deletionIntent: cleanString(entry.deletionIntent) || null,
    replacementEvidence: entry.replacementEvidence ?? null,
    wholeFileDeletion: entry.wholeFileDeletion === true
      ? true
      : entry.wholeFileDeletion === false
        ? false
        : null,
  };
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function validatePolicyCompatibilityDeletionExecutionManifestEntry(entry = {}) {
  const value = normalizePolicyCompatibilityDeletionExecutionManifestEntry(entry);
  const issues = [];
  const namedTestScope = isPolicyCompatibilityDeletionNamedTestScopeEntry(value);

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS)
    .includes(value.actionId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.ACTION_UNKNOWN,
      'Compatibility deletion execution-manifest entries require a recognized action.',
      { actionId: value.actionId || null }
    ));
  }

  if (!value.path) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.PATH_MISSING,
      'Compatibility deletion execution-manifest entries require an exact repository path.'
    ));
  }

  if (namedTestScope) {
    if (value.sourceTextFragments.length === 0) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.SOURCE_FRAGMENT_MISSING,
        'Named test-scope entries require exact source fragments so a retained test file is never treated as a whole-file deletion.'
      ));
    }

    if (value.testNameFragments.length === 0) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.TEST_NAME_FRAGMENT_MISSING,
        'Named test-scope entries require exact test-name fragments.'
      ));
    }

    if (value.wholeFileDeletion !== false) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.WHOLE_FILE_DELETION_ALLOWED,
        'Named test-scope entries must explicitly prohibit whole-file deletion.'
      ));
    }
  } else if (value.testNameFragments.length > 0 || value.wholeFileDeletion === true) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.FILE_ENTRY_SCOPE_PRESENT,
      'File-path manifest entries cannot carry named-test-scope test fragments or whole-file-deletion scope flags.'
    ));
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS,
  isPolicyCompatibilityDeletionNamedTestScopeEntry,
  normalizePolicyCompatibilityDeletionExecutionManifestEntry,
  validatePolicyCompatibilityDeletionExecutionManifestEntry,
};
