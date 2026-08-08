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

import {
  buildPolicyRuntimeReleaseMaintenanceInventory,
} from './policyRuntimeReleaseMaintenanceInventory.mjs';
import {
  collectRepositoryTextFiles,
} from './repositoryTextFileCollection.mjs';

const DEFAULT_INCLUDED_ROOTS = Object.freeze([
  'server/src',
  'client/src',
  'scripts/generate-policy-controlled-removal-apply.mjs',
]);

function loadPolicyRuntimeReleaseMaintenanceRepositoryFiles({
  rootDir = process.cwd(),
} = {}) {
  return collectRepositoryTextFiles({
    rootDir,
    includedRoots: DEFAULT_INCLUDED_ROOTS,
  });
}

function buildPolicyRuntimeReleaseMaintenanceRepositoryInventory({
  rootDir = process.cwd(),
  generatedAt,
} = {}) {
  const inventory = buildPolicyRuntimeReleaseMaintenanceInventory({
    files: loadPolicyRuntimeReleaseMaintenanceRepositoryFiles({ rootDir }),
    generatedAt,
  });

  return {
    ...inventory,
    scanScope: 'repository',
    sideEffects: {
      ...inventory.sideEffects,
      filesRead: true,
    },
  };
}

export {
  DEFAULT_INCLUDED_ROOTS,
  buildPolicyRuntimeReleaseMaintenanceRepositoryInventory,
  loadPolicyRuntimeReleaseMaintenanceRepositoryFiles,
};
