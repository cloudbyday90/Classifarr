/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'node:path';

import {
  isPolicyCompatibilityDeletionNamedTestScopeEntry,
} from './policyCompatibilityDeletionExecutionManifestEntry.mjs';

const POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS = Object.freeze({
  MANIFEST_ENTRY_SCOPE_UNSUPPORTED: 'manifest_entry_scope_unsupported',
  MANIFEST_PATH_INVALID: 'manifest_path_invalid',
  MANIFEST_PATH_DUPLICATE: 'manifest_path_duplicate',
  SELECTED_PATH_INVALID: 'selected_path_invalid',
  SELECTED_PATH_DUPLICATE: 'selected_path_duplicate',
  SELECTED_PATH_NOT_IN_MANIFEST: 'selected_path_not_in_manifest',
  SELECTED_ENTRY_NOT_READY: 'selected_entry_not_ready',
  SELECTED_ENTRY_REPLACEMENT_EVIDENCE_INVALID:
    'selected_entry_replacement_evidence_invalid',
  REMOVAL_SCOPE_TOO_BROAD: 'removal_scope_too_broad',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeRepositoryPath(value = '') {
  return typeof value === 'string' ? value.replace(/\\/g, '/').trim() : '';
}

function isCanonicalRepositoryPath(value = '') {
  const normalizedPath = normalizeRepositoryPath(value);

  if (
    value !== normalizedPath ||
    !normalizedPath ||
    normalizedPath.includes('\0') ||
    path.posix.isAbsolute(normalizedPath) ||
    path.win32.isAbsolute(normalizedPath) ||
    path.posix.normalize(normalizedPath) !== normalizedPath
  ) {
    return false;
  }

  return normalizedPath
    .split('/')
    .every(segment => segment && segment !== '.' && segment !== '..');
}

function hasMeaningfulReplacementEvidence(value, visited = new Set()) {
  if (typeof value === 'string') return Boolean(value.trim());
  if (Array.isArray(value)) {
    return value.some(entry => hasMeaningfulReplacementEvidence(entry, visited));
  }
  if (!value || typeof value !== 'object' || visited.has(value)) return false;

  visited.add(value);
  return Object.values(value)
    .some(entry => hasMeaningfulReplacementEvidence(entry, visited));
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function evaluateManifestEntries(manifestEntries = []) {
  const entryByPath = new Map();
  const risks = [];

  asArray(manifestEntries).forEach((entry, entryIndex) => {
    const value = asObject(entry);
    const repositoryPath = normalizeRepositoryPath(value.path);

    if (isPolicyCompatibilityDeletionNamedTestScopeEntry(value)) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS
          .MANIFEST_ENTRY_SCOPE_UNSUPPORTED,
        'Controlled compatibility path removal cannot select named test scopes; they require a separate scope-aware removal component.',
        { entryIndex, path: repositoryPath || null }
      ));
      return;
    }

    if (!isCanonicalRepositoryPath(value.path)) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.MANIFEST_PATH_INVALID,
        'Controlled compatibility path removal requires canonical repository-relative manifest paths.',
        { entryIndex, path: value.path || null }
      ));
      return;
    }

    if (entryByPath.has(repositoryPath)) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.MANIFEST_PATH_DUPLICATE,
        'Controlled compatibility path removal requires each approved manifest path to be unique.',
        { entryIndex, path: repositoryPath }
      ));
      return;
    }

    entryByPath.set(repositoryPath, value);
  });

  return { entryByPath, risks };
}

function evaluateSelectedPaths({
  selectedPaths = [],
  entryByPath = new Map(),
  maxBatchSize = 3,
} = {}) {
  const selectedEntries = [];
  const selectedPathSet = new Set();
  const missingPaths = [];
  const risks = [];

  asArray(selectedPaths).forEach((rawPath, selectionIndex) => {
    const repositoryPath = normalizeRepositoryPath(rawPath);

    if (!isCanonicalRepositoryPath(rawPath)) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.SELECTED_PATH_INVALID,
        'Controlled compatibility path removal requires canonical repository-relative selected paths.',
        { selectionIndex, path: typeof rawPath === 'string' ? rawPath : null }
      ));
      return;
    }

    if (selectedPathSet.has(repositoryPath)) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.SELECTED_PATH_DUPLICATE,
        'Controlled compatibility path removal requires selected paths to be unique.',
        { selectionIndex, path: repositoryPath }
      ));
      return;
    }

    selectedPathSet.add(repositoryPath);
    const entry = entryByPath.get(repositoryPath);
    if (!entry) {
      missingPaths.push(repositoryPath);
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS
          .SELECTED_PATH_NOT_IN_MANIFEST,
        'Controlled compatibility path removal can only target paths from the approved manifest.',
        { path: repositoryPath }
      ));
      return;
    }

    selectedEntries.push(entry);
    if (entry.ready !== true) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.SELECTED_ENTRY_NOT_READY,
        'Selected compatibility path removal entries must be marked ready by the approved manifest.',
        { path: repositoryPath, categoryId: entry.categoryId || null }
      ));
    }

    if (!hasMeaningfulReplacementEvidence(entry.replacementEvidence)) {
      risks.push(buildRisk(
        POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS
          .SELECTED_ENTRY_REPLACEMENT_EVIDENCE_INVALID,
        'Selected compatibility path removal entries require meaningful replacement evidence.',
        { path: repositoryPath, categoryId: entry.categoryId || null }
      ));
    }
  });

  if (selectedPathSet.size > maxBatchSize) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.REMOVAL_SCOPE_TOO_BROAD,
      'Controlled compatibility path removal requires a narrow, reviewable batch.',
      { selectedCount: selectedPathSet.size, maxBatchSize }
    ));
  }

  return {
    requestedPathCount: asArray(selectedPaths).length,
    selectedPaths: [...selectedPathSet],
    selectedEntries,
    missingPaths,
    risks,
  };
}

function evaluatePolicyControlledCompatibilityPathRemovalSelection({
  manifestEntries = [],
  selectedPaths = [],
  maxBatchSize = 3,
} = {}) {
  const manifest = evaluateManifestEntries(manifestEntries);
  const selection = evaluateSelectedPaths({
    selectedPaths,
    entryByPath: manifest.entryByPath,
    maxBatchSize,
  });

  return {
    manifestEntryCount: manifest.entryByPath.size,
    ...selection,
    risks: [...manifest.risks, ...selection.risks],
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS,
  evaluatePolicyControlledCompatibilityPathRemovalSelection,
  hasMeaningfulReplacementEvidence,
  isCanonicalRepositoryPath,
  normalizeRepositoryPath,
};
