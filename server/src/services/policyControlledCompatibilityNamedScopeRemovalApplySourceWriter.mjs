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

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from './policyCompatibilityDeletionExecutionActions.mjs';
import {
  applyPolicyControlledCompatibilityNamedScopeSourceEdits,
} from './policyControlledCompatibilityNamedScopeSourceEdit.mjs';
import {
  asObject,
  cleanString,
  isSha256Fingerprint,
} from './policyControlledCompatibilityNamedScopeRemovalApplyShared.mjs';

function buildSha256(value = '') {
  return createHash('sha256').update(value).digest('hex');
}

function isPathInsideRoot(rootPath, candidatePath, pathModule = path) {
  const relativePath = pathModule.relative(rootPath, candidatePath);

  return relativePath !== '' && relativePath !== '..' &&
    !relativePath.startsWith(`..${pathModule.sep}`) && !pathModule.isAbsolute(relativePath);
}

async function resolveRegularSourcePath({ fsPromises, pathModule, repoRoot, sourcePath }) {
  if (!pathModule.isAbsolute(repoRoot) || !cleanString(sourcePath) || pathModule.isAbsolute(sourcePath)) {
    throw new Error('Controlled scope removal source path must be repo-relative.');
  }

  const realRepoRoot = await fsPromises.realpath(repoRoot);
  const absoluteSourcePath = pathModule.resolve(realRepoRoot, sourcePath);
  if (!isPathInsideRoot(realRepoRoot, absoluteSourcePath, pathModule)) {
    throw new Error('Controlled scope removal source path escapes the repository.');
  }

  const realParentPath = await fsPromises.realpath(pathModule.dirname(absoluteSourcePath));
  if (!isPathInsideRoot(realRepoRoot, realParentPath, pathModule) && realParentPath !== realRepoRoot) {
    throw new Error('Controlled scope removal source parent escapes the repository.');
  }
  const sourceStats = await fsPromises.lstat(absoluteSourcePath);
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
    throw new Error('Controlled scope removal source must be a regular non-symlink file.');
  }

  return {
    absoluteSourcePath,
    realParentPath,
    realRepoRoot,
    relativeSourcePath: cleanString(sourcePath),
  };
}

function validateEdits({ sourceText, scopeRemovalDryRun }) {
  const dryRun = asObject(scopeRemovalDryRun);
  const selectedScope = asObject(dryRun.selectedScope);
  const source = asObject(dryRun.source);
  const sourceEdit = asObject(dryRun.dryRun);
  const edits = Array.isArray(sourceEdit.edits) ? sourceEdit.edits : [];

  if (dryRun.readyForScopeRemovalReview !== true || dryRun.riskCount !== 0 ||
      selectedScope.wholeFileDeletion !== false ||
      sourceEdit.operationId !== POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS
        .REMOVE_NAMED_TEST_SCOPE ||
      !isSha256Fingerprint(source.fingerprint) ||
      !isSha256Fingerprint(sourceEdit.sourceFingerprint) ||
      !isSha256Fingerprint(sourceEdit.resultFingerprint) ||
      source.fingerprint !== sourceEdit.sourceFingerprint ||
      source.fingerprint !== buildSha256(sourceText) ||
      edits.length === 0 || edits.length !== sourceEdit.editCount) {
    throw new Error('Controlled scope removal dry-run source evidence is invalid.');
  }

  const orderedEdits = [...edits].sort((left, right) => left.startOffset - right.startOffset);
  const names = new Set();
  orderedEdits.forEach((edit, index) => {
    const previousEdit = orderedEdits[index - 1];
    if (!cleanString(edit?.testName) || names.has(edit.testName) ||
        !Number.isInteger(edit.startOffset) || !Number.isInteger(edit.endOffset) ||
        edit.startOffset < 0 || edit.endOffset <= edit.startOffset ||
        edit.endOffset > sourceText.length ||
        (previousEdit && previousEdit.endOffset > edit.startOffset) ||
        !isSha256Fingerprint(edit.expectedTextFingerprint) ||
        buildSha256(sourceText.slice(edit.startOffset, edit.endOffset)) !== edit.expectedTextFingerprint) {
      throw new Error('Controlled scope removal dry-run edits do not match the current source.');
    }
    names.add(edit.testName);
  });

  const resultSourceText = applyPolicyControlledCompatibilityNamedScopeSourceEdits(
    sourceText,
    orderedEdits
  );
  if (buildSha256(resultSourceText) !== sourceEdit.resultFingerprint) {
    throw new Error('Controlled scope removal dry-run result fingerprint is invalid.');
  }

  return {
    edits: orderedEdits,
    resultFingerprint: sourceEdit.resultFingerprint,
    resultSourceText,
    sourceFingerprint: source.fingerprint,
  };
}

async function writeReplacement({
  expectedSourceFingerprint,
  fsPromises,
  pathModule,
  prepared,
  replacementSourceText,
  uuid,
}) {
  const currentParentPath = await fsPromises.realpath(pathModule.dirname(prepared.absoluteSourcePath));
  if (currentParentPath !== prepared.realParentPath ||
      (!isPathInsideRoot(prepared.realRepoRoot, currentParentPath, pathModule) &&
      currentParentPath !== prepared.realRepoRoot)) {
    throw new Error('Controlled scope removal source parent changed after preparation.');
  }
  const sourceStats = await fsPromises.lstat(prepared.absoluteSourcePath);
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
    throw new Error('Controlled scope removal source changed after preparation.');
  }
  const currentSourceText = await fsPromises.readFile(prepared.absoluteSourcePath, 'utf8');
  if (buildSha256(currentSourceText) !== expectedSourceFingerprint) {
    throw new Error('Controlled scope removal source changed after final fingerprint verification.');
  }

  const temporaryPath = pathModule.join(
    prepared.realParentPath,
    `.${pathModule.basename(prepared.absoluteSourcePath)}.classifarr-${uuid()}.tmp`
  );
  try {
    const temporaryHandle = await fsPromises.open(temporaryPath, 'wx', 0o600);
    try {
      await temporaryHandle.writeFile(replacementSourceText, 'utf8');
      await temporaryHandle.sync();
    } finally {
      await temporaryHandle.close();
    }
    await fsPromises.rename(temporaryPath, prepared.absoluteSourcePath);
  } finally {
    try {
      await fsPromises.rm(temporaryPath, { force: true });
    } catch (_error) {
      // A stale temporary file is safer than reporting a successful replacement as failed.
    }
  }
}

function createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter({
  fsPromises = fs,
  pathModule = path,
  uuid = randomUUID,
} = {}) {
  async function prepare({ repoRoot, scopeRemovalDryRun } = {}) {
    const sourcePath = cleanString(scopeRemovalDryRun?.selectedScope?.path);
    const resolvedPath = await resolveRegularSourcePath({
      fsPromises,
      pathModule,
      repoRoot,
      sourcePath,
    });
    const originalSourceText = await fsPromises.readFile(resolvedPath.absoluteSourcePath, 'utf8');
    const sourceEdit = validateEdits({ sourceText: originalSourceText, scopeRemovalDryRun });

    return {
      ...resolvedPath,
      originalSourceText,
      resultFingerprint: sourceEdit.resultFingerprint,
      resultSourceText: sourceEdit.resultSourceText,
      sourceFingerprint: sourceEdit.sourceFingerprint,
    };
  }

  async function apply(prepared = {}) {
    await writeReplacement({
      expectedSourceFingerprint: prepared.sourceFingerprint,
      fsPromises,
      pathModule,
      prepared,
      replacementSourceText: prepared.resultSourceText,
      uuid,
    });

    return {
      resultFingerprint: prepared.resultFingerprint,
      sourcePath: prepared.relativeSourcePath,
    };
  }

  async function restore(prepared = {}) {
    await writeReplacement({
      expectedSourceFingerprint: prepared.resultFingerprint,
      fsPromises,
      pathModule,
      prepared,
      replacementSourceText: prepared.originalSourceText,
      uuid,
    });

    return {
      sourceFingerprint: prepared.sourceFingerprint,
      sourcePath: prepared.relativeSourcePath,
    };
  }

  return { apply, prepare, restore };
}

export {
  createPolicyControlledCompatibilityNamedScopeRemovalApplySourceWriter,
};
