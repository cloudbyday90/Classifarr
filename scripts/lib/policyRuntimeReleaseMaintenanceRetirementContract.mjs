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

const RETIRED_NAMED_SCOPE_MODULE_PATHS = Object.freeze([
  'server/src/services/policyControlledCompatibilityNamedScopePreApplyRecheck.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalAdapter.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalAdapterShared.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalApply.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalApplyOperationStore.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalApplyShared.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalApplySourceWriter.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalDatabaseScopeLock.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalGate.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalProductionAdmission.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalProductionAdmissionConfig.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalReviewArtifact.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalReviewArtifactProjection.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalReviewArtifactShared.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapterShared.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalSelection.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeSourceEdit.mjs',
  'server/src/services/policyControlledCompatibilityNamedScopeSourceRead.mjs',
]);

const RETIRED_SOURCE_MUTATION_MODULE_PATHS = Object.freeze([
  'server/src/services/policyControlledRemovalFileApplyAdapter.mjs',
  ...RETIRED_NAMED_SCOPE_MODULE_PATHS,
]);

const RETIRED_RELEASE_MAINTENANCE_ENTRY_PATHS = Object.freeze([
  'scripts/generate-policy-controlled-removal-apply.mjs',
]);

const RETIRED_RELEASE_MAINTENANCE_COMMAND_IDS = Object.freeze([
  'policy:controlled-removal-apply',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readPackageScripts(fileMap) {
  const packageSource = fileMap.get('package.json');

  if (!packageSource) {
    return {};
  }

  try {
    return asObject(JSON.parse(packageSource).scripts);
  } catch {
    return {};
  }
}

function collectWorkflowWritePermissions(fileMap) {
  return [...fileMap.entries()]
    .filter(([filePath]) => (
      filePath.startsWith('.github/workflows/') && /\.ya?ml$/i.test(filePath)
    ))
    .flatMap(([workflowPath, source]) => String(source).split(/\r?\n/).flatMap((line, index) => {
      const normalizedLine = line.replace(/\s+#.*$/, '').trim();
      const permissionId = /(?:^|[,{]\s*)contents\s*:\s*['"]?write(?:-all)?['"]?(?=\s*(?:,|}|$))/i
        .test(normalizedLine)
        ? 'contents_write'
        : /^permissions\s*:\s*['"]?write-all['"]?$/i.test(normalizedLine)
          ? 'write_all'
          : null;

      return permissionId ? [{
        lineNumber: index + 1,
        permissionId,
        workflowPath,
      }] : [];
    }))
    .sort((left, right) => (
      left.workflowPath.localeCompare(right.workflowPath) || left.lineNumber - right.lineNumber
    ));
}

function buildRetiredRepositoryMutationContract({ fileMap = new Map() } = {}) {
  const packageScripts = readPackageScripts(fileMap);

  return {
    retiredReleaseMaintenanceCommands: RETIRED_RELEASE_MAINTENANCE_COMMAND_IDS.map(commandId => ({
      commandId,
      commandValue: packageScripts[commandId] || null,
      commandStateId: packageScripts[commandId] ? 'present_pending_decommission' : 'removed',
    })),
    retiredReleaseMaintenanceEntries: RETIRED_RELEASE_MAINTENANCE_ENTRY_PATHS.map(entryPath => ({
      entryPath,
      entryStateId: fileMap.has(entryPath) ? 'present_pending_decommission' : 'removed',
    })),
    retiredSourceMutationModules: RETIRED_SOURCE_MUTATION_MODULE_PATHS.map(modulePath => ({
      modulePath,
      moduleStateId: fileMap.has(modulePath) ? 'present_pending_decommission' : 'removed',
    })),
    workflowWritePermissions: collectWorkflowWritePermissions(fileMap),
  };
}

export {
  RETIRED_NAMED_SCOPE_MODULE_PATHS,
  RETIRED_RELEASE_MAINTENANCE_COMMAND_IDS,
  RETIRED_RELEASE_MAINTENANCE_ENTRY_PATHS,
  RETIRED_SOURCE_MUTATION_MODULE_PATHS,
  buildRetiredRepositoryMutationContract,
  collectWorkflowWritePermissions,
};
