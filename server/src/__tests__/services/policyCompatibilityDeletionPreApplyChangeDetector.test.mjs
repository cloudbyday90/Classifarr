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
import os from 'node:os';
import path from 'node:path';

import { jest } from '@jest/globals';

import {
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS,
  verifyPolicyCompatibilityDeletionPreApplyChange,
} from '../../services/policyCompatibilityDeletionPreApplyChangeDetector.mjs';

const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const MANIFEST_PATH = 'compatibility/legacy.mjs';
const BLOB_ID = 'abcdef0123456789abcdef0123456789abcdef0123';

function writeFixtureFile(rootPath, relativePath = MANIFEST_PATH) {
  const filePath = path.join(rootPath, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'legacy compatibility fixture\n');
  return filePath;
}

function preflightEvidence({
  sourceRevision = SOURCE_REVISION,
  manifestPath = MANIFEST_PATH,
} = {}) {
  return {
    checkout: { sourceRevision },
    manifest: {
      entries: [{ path: manifestPath, statusId: 'observed' }],
    },
  };
}

function createCommandRunner({
  checkoutRevision = SOURCE_REVISION,
  diffStatus = 0,
  fixtureRoot,
  headTreeOutput = null,
} = {}) {
  return jest.fn(({ command, args }) => {
    if (command !== 'git') return { status: 2, stdout: '' };

    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
      return { status: 0, stdout: `${fixtureRoot}\n` };
    }
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
      return { status: 0, stdout: `${checkoutRevision}\n` };
    }
    if (args[0] === 'ls-tree') {
      const requestedPath = args.at(-1);
      const output = headTreeOutput ?? `100644 blob ${BLOB_ID}\t${requestedPath}\u0000`;

      return { status: 0, stdout: output };
    }
    if (args[0] === 'diff') {
      return { status: diffStatus, stdout: '' };
    }

    return { status: 2, stdout: '' };
  });
}

describe('policyCompatibilityDeletionPreApplyChangeDetector', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'classifarr-pre-apply-change-detector-')
    );
    writeFixtureFile(fixtureRoot);
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('verifies the current revision, regular path, HEAD blob, and clean path immediately before apply', () => {
    const commandRunner = createCommandRunner({ fixtureRoot });
    const verification = verifyPolicyCompatibilityDeletionPreApplyChange({
      entry: { path: MANIFEST_PATH, actionId: 'delete_file' },
      preflightEvidenceArtifact: preflightEvidence(),
      repoRoot: fixtureRoot,
      commandRunner,
    });

    expect(verification).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS
        .VERIFIED,
      verified: true,
      validation: expect.objectContaining({ ok: true }),
      checkout: {
        expectedSourceRevision: SOURCE_REVISION,
        currentSourceRevision: SOURCE_REVISION,
      },
      headTreeEntry: expect.objectContaining({
        mode: '100644',
        type: 'blob',
        path: MANIFEST_PATH,
      }),
      sideEffects: {
        filesDeleted: false,
        gitCommandsRun: false,
        storageChanged: false,
      },
    }));
    expect(commandRunner.mock.calls.map(([call]) => call.args)).toEqual([
      ['rev-parse', '--show-toplevel'],
      ['rev-parse', 'HEAD'],
      ['ls-tree', '-z', '--full-tree', 'HEAD', '--', MANIFEST_PATH],
      ['diff', '--quiet', '--no-ext-diff', 'HEAD', '--', MANIFEST_PATH],
    ]);
  });

  test('fails closed when the checkout revision changed after preflight', () => {
    const verification = verifyPolicyCompatibilityDeletionPreApplyChange({
      entry: { path: MANIFEST_PATH },
      preflightEvidenceArtifact: preflightEvidence(),
      repoRoot: fixtureRoot,
      commandRunner: createCommandRunner({
        fixtureRoot,
        checkoutRevision: 'fedcba9876543210fedcba9876543210fedcba98',
      }),
    });

    expect(verification.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.BLOCKED);
    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS
          .CHECKOUT_REVISION_CHANGED,
      }),
    ]));
  });

  test('fails closed when the approved file differs from HEAD', () => {
    const verification = verifyPolicyCompatibilityDeletionPreApplyChange({
      entry: { path: MANIFEST_PATH },
      preflightEvidenceArtifact: preflightEvidence(),
      repoRoot: fixtureRoot,
      commandRunner: createCommandRunner({ fixtureRoot, diffStatus: 1 }),
    });

    expect(verification.verified).toBe(false);
    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS
          .WORKTREE_PATH_CHANGED,
      }),
    ]));
  });

  test('rejects a symbolic-link path before it reaches the adapter', () => {
    const symbolicLinkFileSystem = {
      ...fs,
      lstatSync() {
        return {
          isFile: () => false,
          isSymbolicLink: () => true,
        };
      },
    };
    const verification = verifyPolicyCompatibilityDeletionPreApplyChange({
      entry: { path: MANIFEST_PATH },
      preflightEvidenceArtifact: preflightEvidence(),
      repoRoot: fixtureRoot,
      commandRunner: createCommandRunner({ fixtureRoot }),
      fileSystem: symbolicLinkFileSystem,
    });

    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS
          .PATH_SYMBOLIC_LINK,
      }),
    ]));
  });

  test('rejects a disappeared approved file before it reaches the adapter', () => {
    fs.rmSync(path.join(fixtureRoot, ...MANIFEST_PATH.split('/')));
    const verification = verifyPolicyCompatibilityDeletionPreApplyChange({
      entry: { path: MANIFEST_PATH },
      preflightEvidenceArtifact: preflightEvidence(),
      repoRoot: fixtureRoot,
      commandRunner: createCommandRunner({ fixtureRoot }),
    });

    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS
          .PATH_MISSING,
      }),
    ]));
  });

  test('rejects a tree entry that is not an approved regular blob', () => {
    const verification = verifyPolicyCompatibilityDeletionPreApplyChange({
      entry: { path: MANIFEST_PATH },
      preflightEvidenceArtifact: preflightEvidence(),
      repoRoot: fixtureRoot,
      commandRunner: createCommandRunner({
        fixtureRoot,
        headTreeOutput: `120000 blob ${BLOB_ID}\t${MANIFEST_PATH}\u0000`,
      }),
    });

    expect(verification.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_RISK_IDS
          .HEAD_TREE_ENTRY_INVALID,
      }),
    ]));
  });

  test('keeps a path that begins with dashes after the fixed Git argument separator', () => {
    const dashPath = '--not-a-git-option.mjs';
    writeFixtureFile(fixtureRoot, dashPath);
    const commandRunner = createCommandRunner({ fixtureRoot });
    const verification = verifyPolicyCompatibilityDeletionPreApplyChange({
      entry: { path: dashPath },
      preflightEvidenceArtifact: preflightEvidence({ manifestPath: dashPath }),
      repoRoot: fixtureRoot,
      commandRunner,
    });

    expect(verification.verified).toBe(true);
    expect(commandRunner.mock.calls.map(([call]) => call.args)).toEqual(expect.arrayContaining([
      ['ls-tree', '-z', '--full-tree', 'HEAD', '--', dashPath],
      ['diff', '--quiet', '--no-ext-diff', 'HEAD', '--', dashPath],
    ]));
  });
});
