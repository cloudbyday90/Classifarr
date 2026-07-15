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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionPlan.mjs';

function normalizePolicyControlledRemovalRepoPath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function resolvePolicyControlledRemovalRepoRelativePath({
  repoPath,
  repoRoot = process.cwd(),
} = {}) {
  const normalizedPath = normalizePolicyControlledRemovalRepoPath(repoPath);

  if (!normalizedPath) {
    throw new Error('Removal entry path is empty.');
  }

  if (path.isAbsolute(normalizedPath)) {
    throw new Error(`Removal entry path must be repo-relative: ${repoPath}`);
  }

  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedPath = path.resolve(resolvedRepoRoot, normalizedPath);
  const relativePath = path.relative(resolvedRepoRoot, resolvedPath);

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Removal entry path escapes the repository: ${repoPath}`);
  }

  return {
    normalizedPath,
    resolvedPath,
  };
}

function buildSideEffects({
  filesDeleted = false,
  testsRemoved = false,
} = {}) {
  return {
    filesDeleted,
    filesArchived: false,
    routesRemoved: false,
    testsRemoved,
    storageChanged: false,
    gitCommandsRun: false,
  };
}

function buildApplyResult({
  entry = {},
  normalizedPath,
  applied = false,
  operationId = null,
  sideEffects = {},
} = {}) {
  return {
    path: normalizedPath,
    actionId: entry.actionId,
    categoryId: entry.categoryId,
    applied,
    operationId,
    sideEffects: buildSideEffects(sideEffects),
  };
}

function createPolicyControlledRemovalFileApplyAdapter({
  applyFiles = false,
  repoRoot = process.cwd(),
} = {}) {
  return {
    async applyEntry(entry = {}) {
      const { normalizedPath, resolvedPath } =
        resolvePolicyControlledRemovalRepoRelativePath({
          repoPath: entry.path,
          repoRoot,
        });
      const supportedAction = [
        POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
        POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
      ].includes(entry.actionId);

      if (!supportedAction) {
        return buildApplyResult({ entry, normalizedPath });
      }

      if (applyFiles !== true) {
        return buildApplyResult({
          entry,
          normalizedPath,
          operationId: 'apply-files-flag-required',
        });
      }

      // resolvedPath was normalized and contained to repoRoot immediately above.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const stat = fs.lstatSync(resolvedPath, { throwIfNoEntry: false });

      if (!stat?.isFile()) {
        return buildApplyResult({
          entry,
          normalizedPath,
          operationId: 'file-not-found',
        });
      }

      fs.rmSync(resolvedPath, {
        force: false,
        recursive: false,
      });

      return buildApplyResult({
        entry,
        normalizedPath,
        applied: true,
        operationId: `deleted:${normalizedPath}`,
        sideEffects: {
          filesDeleted: true,
          testsRemoved:
            entry.actionId ===
            POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
        },
      });
    },
  };
}

export {
  createPolicyControlledRemovalFileApplyAdapter,
  normalizePolicyControlledRemovalRepoPath,
  resolvePolicyControlledRemovalRepoRelativePath,
};
