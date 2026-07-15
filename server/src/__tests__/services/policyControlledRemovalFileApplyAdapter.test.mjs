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

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  createPolicyControlledRemovalFileApplyAdapter,
  resolvePolicyControlledRemovalRepoRelativePath,
} from '../../services/policyControlledRemovalFileApplyAdapter.mjs';

describe('policyControlledRemovalFileApplyAdapter', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-removal-adapter-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('requires an explicit apply flag before deleting a repo-relative file', async () => {
    const relativePath = 'compatibility/legacy.mjs';
    const targetPath = path.join(fixtureRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, 'legacy compatibility path\n');
    const adapter = createPolicyControlledRemovalFileApplyAdapter({
      applyFiles: false,
      repoRoot: fixtureRoot,
    });

    const result = await adapter.applyEntry({
      path: relativePath,
      actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.DELETE_FILE,
      categoryId: 'client_bridge_ui',
    });

    expect(result).toEqual(expect.objectContaining({
      applied: false,
      operationId: 'apply-files-flag-required',
      sideEffects: expect.objectContaining({ filesDeleted: false }),
    }));
    expect(fs.existsSync(targetPath)).toBe(true);
  });

  test('deletes only a regular file inside the configured repository root', async () => {
    const relativePath = 'compatibility/legacy.mjs';
    const targetPath = path.join(fixtureRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, 'legacy compatibility path\n');
    const adapter = createPolicyControlledRemovalFileApplyAdapter({
      applyFiles: true,
      repoRoot: fixtureRoot,
    });

    const result = await adapter.applyEntry({
      path: relativePath,
      actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
      categoryId: 'client_bridge_ui',
    });

    expect(result).toEqual(expect.objectContaining({
      path: relativePath,
      applied: true,
      operationId: `deleted:${relativePath}`,
      sideEffects: expect.objectContaining({
        filesDeleted: true,
        testsRemoved: true,
        filesArchived: false,
        storageChanged: false,
        gitCommandsRun: false,
      }),
    }));
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  test('rejects traversal and absolute paths before filesystem access', () => {
    expect(() => resolvePolicyControlledRemovalRepoRelativePath({
      repoPath: '../outside.mjs',
      repoRoot: fixtureRoot,
    })).toThrow('escapes the repository');
    expect(() => resolvePolicyControlledRemovalRepoRelativePath({
      repoPath: path.join(path.dirname(fixtureRoot), 'outside.mjs'),
      repoRoot: fixtureRoot,
    })).toThrow('must be repo-relative');
  });
});
