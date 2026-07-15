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

import path from 'node:path';
import { jest } from '@jest/globals';

import {
  collectPolicyStorageClosurePathStateObservations,
} from '../../services/policyStorageClosurePathStateCollector.mjs';
import {
  POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS,
  buildPathStateExecutionPlanArtifact,
} from './fixtures/policyStorageClosurePathStateEvidenceFixtures.mjs';

describe('policyStorageClosurePathStateCollector', () => {
  test('collects one read-only observation for each approved manifest path', () => {
    const fileExists = jest.fn(absolutePath => absolutePath.endsWith('legacyA.mjs'));
    const cwd = path.resolve('path-state-collector-fixture');
    const result = collectPolicyStorageClosurePathStateObservations({
      executionPlanArtifact: buildPathStateExecutionPlanArtifact(),
      cwd,
      fileExists,
    });

    expect(result.executionPlanSource.ok).toBe(true);
    expect(result.observations).toEqual([
      { path: POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0], exists: true },
      { path: POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[1], exists: false },
    ]);
    expect(fileExists).toHaveBeenCalledTimes(2);
    expect(fileExists).toHaveBeenCalledWith(
      path.resolve(cwd, POLICY_STORAGE_CLOSURE_PATH_STATE_MANIFEST_PATHS[0])
    );
  });

  test('does not inspect the checkout when the manifest source is invalid', () => {
    const fileExists = jest.fn();
    const result = collectPolicyStorageClosurePathStateObservations({
      executionPlanArtifact: {},
      fileExists,
    });

    expect(result.executionPlanSource.ok).toBe(false);
    expect(result.observations).toEqual([]);
    expect(fileExists).not.toHaveBeenCalled();
  });
});
