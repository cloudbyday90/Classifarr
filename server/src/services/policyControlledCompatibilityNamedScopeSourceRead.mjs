/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  isCanonicalRepositoryPath,
  normalizeRepositoryPath,
} from './policyControlledCompatibilityPathRemovalSelection.mjs';
import {
  buildRisk,
  MAX_POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_BYTES,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
} from './policyControlledCompatibilityNamedScopeRemovalAdapterShared.mjs';

function readPolicyControlledCompatibilityNamedScopeSource({
  entry,
  fileSystem = fs,
  pathModule = path,
  repoRoot = process.cwd(),
} = {}) {
  const repositoryPath = normalizeRepositoryPath(entry?.path);
  const risks = [];
  let realRepoRoot = null;
  let sourcePath = null;
  let sourceText = null;

  if (!isCanonicalRepositoryPath(entry?.path)) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_PATH_INVALID,
      'Scope-aware removal requires a canonical repository-relative retained test path.',
      { path: entry?.path || null }
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }

  try {
    realRepoRoot = fileSystem.realpathSync(pathModule.resolve(repoRoot));
  } catch (_error) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_ROOT_UNAVAILABLE,
      'Scope-aware removal requires a readable repository root.'
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }

  const candidatePath = pathModule.resolve(realRepoRoot, ...repositoryPath.split('/'));
  const relativePath = pathModule.relative(realRepoRoot, candidatePath);

  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${pathModule.sep}`) ||
    pathModule.isAbsolute(relativePath)
  ) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_PATH_INVALID,
      'Scope-aware removal retained test path must stay inside the configured repository root.',
      { path: repositoryPath }
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }

  let stat = null;
  try {
    stat = fileSystem.lstatSync(candidatePath, { throwIfNoEntry: false });
  } catch (_error) {
    stat = null;
  }

  if (!stat) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_FILE_MISSING,
      'Scope-aware removal retained test file no longer exists.',
      { path: repositoryPath }
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }
  if (stat.isSymbolicLink()) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_FILE_SYMLINK,
      'Scope-aware removal refuses a retained test file that is a symbolic link.',
      { path: repositoryPath }
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }
  if (!stat.isFile()) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_FILE_NOT_REGULAR,
      'Scope-aware removal requires a regular retained test file.',
      { path: repositoryPath }
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }
  if (stat.size > MAX_POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_BYTES) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_FILE_TOO_LARGE,
      'Scope-aware removal refuses retained test files that exceed the bounded source-read size.',
      {
        path: repositoryPath,
        size: stat.size,
        maximumSize: MAX_POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_BYTES,
      }
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }

  try {
    sourcePath = fileSystem.realpathSync(candidatePath);
  } catch (_error) {
    sourcePath = null;
  }

  if (sourcePath !== candidatePath) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SOURCE_PATH_REALPATH_CHANGED,
      'Scope-aware removal refuses retained test files that resolve through a changed filesystem path.',
      { path: repositoryPath }
    ));
    return { repositoryPath, risks, sourcePath, sourceText };
  }

  try {
    sourceText = fileSystem.readFileSync(sourcePath, 'utf8');
  } catch (_error) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SOURCE_FILE_READ_FAILED,
      'Scope-aware removal could not re-read the retained test file.',
      { path: repositoryPath }
    ));
  }

  return { repositoryPath, risks, sourcePath, sourceText };
}

export {
  readPolicyControlledCompatibilityNamedScopeSource,
};
