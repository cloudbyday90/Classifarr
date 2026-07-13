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

import {
  buildLegacyCompatibilityBoundaryAudit,
  listLegacyCompatibilityModuleRecords,
} from '../../server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs';
import { findDeliveryTermMatches } from './policyDeliveryTermMatcher.mjs';
import {
  buildPolicyDeliveryTermRemovalCompletionAudit,
} from './policyDeliveryTermRemovalCompletionAudit.mjs';
import {
  collectRepositoryTextFiles,
  normalizeRepoPath,
} from './repositoryTextFileCollection.mjs';

const PRODUCTION_SOURCE_ROOTS = Object.freeze(['client/src', 'server/src']);
const TEST_SOURCE_ROOTS = Object.freeze(['client/src/__tests__', 'server/src/__tests__']);
const MAINTENANCE_DELIVERY_PARSER_PATHS = Object.freeze([
  'scripts/lib/policyDeliveryTermMatcher.mjs',
  'scripts/lib/policyProductLanguageAudit.mjs',
  'scripts/lib/policyProductionNamingInventory.mjs',
]);

const IMPORT_SPECIFIER_PATTERN = /\b(?:import|export)\s*(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function isTestFile(repoPath) {
  return (
    repoPath.includes('/__tests__/') ||
    repoPath.endsWith('.test.js') ||
    repoPath.endsWith('.test.mjs')
  );
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function collectProductionSourceFiles({ rootDir = process.cwd() } = {}) {
  return collectRepositoryTextFiles({
    rootDir,
    includedRoots: PRODUCTION_SOURCE_ROOTS,
  }).filter(file => !isTestFile(file.path));
}

function collectTestSourceFiles({ rootDir = process.cwd() } = {}) {
  return collectRepositoryTextFiles({
    rootDir,
    includedRoots: TEST_SOURCE_ROOTS,
  });
}

function findProductionDeliveryTermMatches(files = []) {
  return files.flatMap(file => findDeliveryTermMatches(file.content).map(match => ({
    repoPath: normalizeRepoPath(file.path),
    lineNumber: match.lineNumber,
    matcherId: match.matcherId,
    token: match.token,
  })));
}

function resolveLocalImportPath(repoPath, specifier) {
  if (!specifier.startsWith('.')) {
    return '';
  }

  return normalizeRepoPath(path.posix.normalize(path.posix.join(
    path.posix.dirname(normalizeRepoPath(repoPath)),
    specifier,
  )));
}

function findMaintenanceParserImports(files = []) {
  return files.flatMap(file => {
    const source = typeof file.content === 'string' ? file.content : '';
    const imports = [];
    const matcher = new RegExp(IMPORT_SPECIFIER_PATTERN.source, IMPORT_SPECIFIER_PATTERN.flags);
    let match = matcher.exec(source);

    while (match) {
      const parserPath = resolveLocalImportPath(file.path, match[1]);

      if (MAINTENANCE_DELIVERY_PARSER_PATHS.includes(parserPath)) {
        imports.push({
          repoPath: normalizeRepoPath(file.path),
          lineNumber: lineNumberAt(source, match.index),
          parserPath,
        });
      }

      match = matcher.exec(source);
    }

    return imports;
  });
}

function buildPolicyDeliveryTermRemovalRepositoryAudit({
  rootDir = process.cwd(),
  generatedAt,
} = {}) {
  const productionFiles = collectProductionSourceFiles({ rootDir });
  const testFiles = collectTestSourceFiles({ rootDir });
  const audit = buildPolicyDeliveryTermRemovalCompletionAudit({
    productionMatches: findProductionDeliveryTermMatches(productionFiles),
    maintenanceImports: findMaintenanceParserImports(productionFiles),
    compatibilityBoundaryAudit: buildLegacyCompatibilityBoundaryAudit(),
    compatibilityModuleRecords: listLegacyCompatibilityModuleRecords(),
    availableProductionPaths: productionFiles.map(file => file.path),
    availableTestPaths: testFiles.map(file => file.path),
    generatedAt,
  });

  return {
    ...audit,
    scanScope: 'production_source_and_compatibility_boundaries',
    sideEffects: {
      ...audit.sideEffects,
      filesRead: true,
    },
  };
}

export {
  IMPORT_SPECIFIER_PATTERN,
  MAINTENANCE_DELIVERY_PARSER_PATHS,
  PRODUCTION_SOURCE_ROOTS,
  TEST_SOURCE_ROOTS,
  buildPolicyDeliveryTermRemovalRepositoryAudit,
  collectProductionSourceFiles,
  collectTestSourceFiles,
  findMaintenanceParserImports,
  findProductionDeliveryTermMatches,
  isTestFile,
  resolveLocalImportPath,
};
