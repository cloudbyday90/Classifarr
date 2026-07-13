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
  buildPolicyProductionNamingInventory,
  validatePolicyBuilderProductionNameInventory,
} from './policyProductionNamingInventory.mjs';
import {
  DEFAULT_EXCLUDED_DIRECTORIES,
  collectRepositoryTextFiles,
} from './repositoryTextFileCollection.mjs';

const DEFAULT_INCLUDED_ROOTS = Object.freeze([
  'server/src',
  'client/src',
  'scripts',
  'database/migrations',
  'docs/architecture',
  'CHANGELOG.md',
  'package.json',
  'server/package.json',
  'client/package.json',
]);

function loadPolicyProductionNamingRepositoryFiles({
  rootDir = process.cwd(),
} = {}) {
  return collectRepositoryTextFiles({
    rootDir,
    includedRoots: DEFAULT_INCLUDED_ROOTS,
  });
}

function buildPolicyProductionNamingRepositoryInventory({
  rootDir = process.cwd(),
  generatedAt,
} = {}) {
  const inventory = buildPolicyProductionNamingInventory({
    files: loadPolicyProductionNamingRepositoryFiles({ rootDir }),
    generatedAt,
  });
  const sideEffects = {
    ...inventory.sideEffects,
    filesRead: true,
  };
  const currentInventory = {
    ...inventory,
    scanScope: 'repository',
    sideEffects,
  };

  return {
    ...currentInventory,
    validation: validatePolicyBuilderProductionNameInventory(currentInventory),
  };
}

export {
  DEFAULT_EXCLUDED_DIRECTORIES,
  DEFAULT_INCLUDED_ROOTS,
  buildPolicyProductionNamingRepositoryInventory,
  loadPolicyProductionNamingRepositoryFiles,
};
