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

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_VERSION =
  'policy.compatibility_deletion_pre_apply_change_detector.v1';
const REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;
const REGULAR_BLOB_MODES = new Set(['100644', '100755']);

const POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS = Object.freeze({
  BLOCKED: 'blocked',
  VERIFIED: 'verified',
});

const POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS = Object.freeze({
  CHECKOUT_REVISION_CHANGED: 'checkout_revision_changed',
  CHECKOUT_REVISION_INVALID: 'checkout_revision_invalid',
  CHECKOUT_REVISION_MISSING: 'checkout_revision_missing',
  HEAD_TREE_ENTRY_INVALID: 'head_tree_entry_invalid',
  HEAD_TREE_ENTRY_MISSING: 'head_tree_entry_missing',
  MANIFEST_ENTRY_NOT_APPROVED: 'manifest_entry_not_approved',
  MANIFEST_PATH_INVALID: 'manifest_path_invalid',
  PATH_ESCAPES_REPOSITORY: 'path_escapes_repository',
  PATH_MISSING: 'path_missing',
  PATH_NOT_REGULAR_FILE: 'path_not_regular_file',
  PATH_REALPATH_CHANGED: 'path_realpath_changed',
  PATH_REALPATH_UNAVAILABLE: 'path_realpath_unavailable',
  PATH_SYMBOLIC_LINK: 'path_symbolic_link',
  REPOSITORY_ROOT_MISMATCH: 'repository_root_mismatch',
  REPOSITORY_ROOT_UNAVAILABLE: 'repository_root_unavailable',
  WORKTREE_PATH_CHANGED: 'worktree_path_changed',
  WORKTREE_PATH_UNVERIFIABLE: 'worktree_path_unverifiable',
  UNKNOWN_STATUS: 'unknown_status',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  VERIFIED_STATE_MISMATCH: 'verified_state_mismatch',
  SIDE_EFFECT_REPORTED: 'side_effect_reported',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function normalizeRevision(value) {
  const revision = typeof value === 'string' ? value.trim().toLowerCase() : '';

  return REVISION_PATTERN.test(revision) ? revision : '';
}

function normalizeRepoRelativePath(value = '') {
  return String(value || '').replace(/\\/g, '/').trim();
}

function isPathInside(rootPath, candidatePath, pathModule = path) {
  const relativePath = pathModule.relative(rootPath, candidatePath);

  return relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${pathModule.sep}`) &&
    !pathModule.isAbsolute(relativePath);
}

function isSameOrPathInside(rootPath, candidatePath, pathModule = path) {
  return rootPath === candidatePath || isPathInside(rootPath, candidatePath, pathModule);
}

function resolveApprovedRepoPath({ repoPath, repoRoot, pathModule = path }) {
  const normalizedPath = normalizeRepoRelativePath(repoPath);

  if (
    !normalizedPath ||
    /[\u0000-\u001f\u007f]/u.test(normalizedPath) ||
    pathModule.isAbsolute(normalizedPath) ||
    pathModule.posix.isAbsolute(normalizedPath)
  ) {
    return { normalizedPath, riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.MANIFEST_PATH_INVALID };
  }

  const portablePath = pathModule.posix.normalize(normalizedPath);

  if (
    portablePath === '.' ||
    portablePath === '..' ||
    portablePath.startsWith('../') ||
    portablePath.startsWith('/')
  ) {
    return { normalizedPath: portablePath, riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.PATH_ESCAPES_REPOSITORY };
  }

  const resolvedPath = pathModule.resolve(repoRoot, ...portablePath.split('/'));

  if (!isPathInside(repoRoot, resolvedPath, pathModule)) {
    return { normalizedPath: portablePath, riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.PATH_ESCAPES_REPOSITORY };
  }

  return { normalizedPath: portablePath, resolvedPath };
}

function createReadOnlyGitCommandRunner() {
  return ({ args, cwd }) => spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: '0',
      GIT_PAGER: 'cat',
    },
    shell: false,
    windowsHide: true,
  });
}

function runGitCommand(commandRunner, args, cwd) {
  try {
    const result = commandRunner({ command: 'git', args, cwd });

    return {
      status: Number.isInteger(result?.status) ? result.status : null,
      stdout: typeof result?.stdout === 'string' ? result.stdout : '',
    };
  } catch (_error) {
    return { status: null, stdout: '' };
  }
}

function parseHeadTreeEntry({ output, expectedPath }) {
  const records = String(output || '').split('\u0000').filter(Boolean);

  if (records.length !== 1) {
    return null;
  }

  const [metadata = '', entryPath = ''] = records[0].split('\t');
  const [mode = '', type = '', objectId = ''] = metadata.split(' ');

  if (
    entryPath !== expectedPath ||
    !REGULAR_BLOB_MODES.has(mode) ||
    type !== 'blob' ||
    !/^[a-f0-9]{40,64}$/iu.test(objectId)
  ) {
    return null;
  }

  return { mode, type, objectId: objectId.toLowerCase(), path: entryPath };
}

function hasApprovedManifestEntry({ preflightEvidenceArtifact, normalizedPath }) {
  return asArray(asObject(preflightEvidenceArtifact).manifest?.entries)
    .some(entry => (
      entry?.statusId === 'observed' &&
      normalizeRepoRelativePath(entry?.path) === normalizedPath
    ));
}

function buildSideEffects() {
  return {
    filesDeleted: false,
    gitCommandsRun: false,
    storageChanged: false,
  };
}

function verifyPolicyCompatibilityDeletionPreApplyChange({
  entry = {},
  preflightEvidenceArtifact = {},
  repoRoot = process.cwd(),
  commandRunner = createReadOnlyGitCommandRunner(),
  fileSystem = fs,
  pathModule = path,
} = {}) {
  const risks = [];
  const expectedSourceRevision = normalizeRevision(
    asObject(preflightEvidenceArtifact).checkout?.sourceRevision
  );
  const requestedPath = normalizeRepoRelativePath(entry?.path);
  let realRepoRoot = null;
  let resolvedPath = null;
  let normalizedPath = requestedPath;
  let currentSourceRevision = null;
  let headTreeEntry = null;

  if (!expectedSourceRevision) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.CHECKOUT_REVISION_MISSING,
      'Pre-apply change detection requires the approved preflight checkout revision.'
    ));
  }

  try {
    realRepoRoot = fileSystem.realpathSync(pathModule.resolve(repoRoot));
  } catch (_error) {
    risks.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.REPOSITORY_ROOT_UNAVAILABLE,
      'Pre-apply change detection requires a readable repository root.'
    ));
  }

  if (realRepoRoot) {
    const resolved = resolveApprovedRepoPath({
      repoPath: requestedPath,
      repoRoot: realRepoRoot,
      pathModule,
    });
    normalizedPath = resolved.normalizedPath;
    resolvedPath = resolved.resolvedPath || null;

    if (resolved.riskId) {
      risks.push(buildRisk(
        resolved.riskId,
        'Pre-apply change detection requires an approved repository-relative manifest path.',
        { path: requestedPath || null }
      ));
    } else if (!hasApprovedManifestEntry({ preflightEvidenceArtifact, normalizedPath })) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.MANIFEST_ENTRY_NOT_APPROVED,
        'Pre-apply change detection requires the selected path to be observed by the approved preflight artifact.',
        { path: normalizedPath }
      ));
    }
  }

  if (realRepoRoot) {
    const gitRootResult = runGitCommand(
      commandRunner,
      ['rev-parse', '--show-toplevel'],
      realRepoRoot
    );

    if (gitRootResult.status !== 0 || !gitRootResult.stdout.trim()) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.REPOSITORY_ROOT_UNAVAILABLE,
        'Pre-apply change detection could not verify the repository root with Git.'
      ));
    } else {
      try {
        const gitRoot = fileSystem.realpathSync(gitRootResult.stdout.trim());

        if (gitRoot !== realRepoRoot) {
          risks.push(buildRisk(
            POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.REPOSITORY_ROOT_MISMATCH,
            'Pre-apply change detection requires the configured root to match the Git checkout root.'
          ));
        }
      } catch (_error) {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.REPOSITORY_ROOT_UNAVAILABLE,
          'Pre-apply change detection could not resolve the Git checkout root.'
        ));
      }
    }

    const revisionResult = runGitCommand(commandRunner, ['rev-parse', 'HEAD'], realRepoRoot);
    currentSourceRevision = normalizeRevision(revisionResult.stdout);

    if (revisionResult.status !== 0 || !currentSourceRevision) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.CHECKOUT_REVISION_INVALID,
        'Pre-apply change detection could not read the current checkout revision.'
      ));
    } else if (expectedSourceRevision && currentSourceRevision !== expectedSourceRevision) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.CHECKOUT_REVISION_CHANGED,
        'The checkout revision changed after the approved preflight artifact was collected.',
        { expectedSourceRevision, currentSourceRevision }
      ));
    }
  }

  if (realRepoRoot && resolvedPath) {
    let stat = null;

    try {
      stat = fileSystem.lstatSync(resolvedPath, { throwIfNoEntry: false });
    } catch (_error) {
      stat = null;
    }

    if (!stat) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.PATH_MISSING,
        'The approved manifest path no longer exists in the checkout.',
        { path: normalizedPath }
      ));
    } else if (stat.isSymbolicLink()) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.PATH_SYMBOLIC_LINK,
        'The approved manifest path is a symbolic link and cannot be removed by the controlled apply boundary.',
        { path: normalizedPath }
      ));
    } else if (!stat.isFile()) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.PATH_NOT_REGULAR_FILE,
        'The approved manifest path is no longer a regular file.',
        { path: normalizedPath }
      ));
    } else {
      try {
        const realPath = fileSystem.realpathSync(resolvedPath);

        if (realPath !== resolvedPath || !isSameOrPathInside(realRepoRoot, realPath, pathModule)) {
          risks.push(buildRisk(
            POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.PATH_REALPATH_CHANGED,
            'The approved manifest path resolves through a changed or external filesystem path.',
            { path: normalizedPath }
          ));
        }
      } catch (_error) {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.PATH_REALPATH_UNAVAILABLE,
          'The approved manifest path could not be resolved safely.',
          { path: normalizedPath }
        ));
      }
    }

    const treeResult = runGitCommand(
      commandRunner,
      ['ls-tree', '-z', '--full-tree', 'HEAD', '--', normalizedPath],
      realRepoRoot
    );

    if (treeResult.status !== 0) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.HEAD_TREE_ENTRY_MISSING,
        'The approved manifest path could not be found in the current checkout tree.',
        { path: normalizedPath }
      ));
    } else {
      headTreeEntry = parseHeadTreeEntry({ output: treeResult.stdout, expectedPath: normalizedPath });

      if (!headTreeEntry) {
        risks.push(buildRisk(
          POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.HEAD_TREE_ENTRY_INVALID,
          'The approved manifest path is not the expected regular blob in the current checkout tree.',
          { path: normalizedPath }
        ));
      }
    }

    const diffResult = runGitCommand(
      commandRunner,
      ['diff', '--quiet', '--no-ext-diff', 'HEAD', '--', normalizedPath],
      realRepoRoot
    );

    if (diffResult.status === 1) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.WORKTREE_PATH_CHANGED,
        'The approved manifest path differs from the current checkout revision.',
        { path: normalizedPath }
      ));
    } else if (diffResult.status !== 0) {
      risks.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.WORKTREE_PATH_UNVERIFIABLE,
        'The controlled apply boundary could not verify that the approved manifest path matches HEAD.',
        { path: normalizedPath }
      ));
    }
  }

  const verification = {
    version: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_VERSION,
    statusId: risks.length === 0
      ? POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.VERIFIED
      : POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.BLOCKED,
    verified: risks.length === 0,
    entry: {
      actionId: entry?.actionId || null,
      path: normalizedPath || null,
    },
    checkout: {
      expectedSourceRevision: expectedSourceRevision || null,
      currentSourceRevision,
    },
    headTreeEntry,
    riskCount: risks.length,
    risks,
    verificationPolicy: {
      requireApprovedPreflightManifestEntry: true,
      requireCurrentCheckoutRevisionMatch: true,
      requireRegularNonSymlinkPath: true,
      requireCurrentHeadRegularBlob: true,
      requirePathMatchesHead: true,
      useReadOnlyGitCommands: true,
      allowGitMutationCommands: false,
    },
    sideEffects: buildSideEffects(),
  };

  return {
    ...verification,
    validation: validatePolicyCompatibilityDeletionPreApplyChange(verification),
  };
}

function validatePolicyCompatibilityDeletionPreApplyChange(verification = {}) {
  const issues = [];

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS)
    .includes(verification.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.UNKNOWN_STATUS,
      'Pre-apply change detection status must be known.'
    ));
  }

  if (verification.riskCount !== asArray(verification.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.RISK_COUNT_MISMATCH,
      'Pre-apply change detection risk count must match risk list length.'
    ));
  }

  if (verification.verified !== (verification.riskCount === 0)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.VERIFIED_STATE_MISMATCH,
      'Pre-apply change detection verified state must match its risk count.'
    ));
  }

  Object.entries(asObject(verification.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS.SIDE_EFFECT_REPORTED,
        `Pre-apply change detection cannot report side effect "${key}".`
      ));
    }
  });

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_VERSION,
  normalizeRepoRelativePath,
  validatePolicyCompatibilityDeletionPreApplyChange,
  verifyPolicyCompatibilityDeletionPreApplyChange,
};
