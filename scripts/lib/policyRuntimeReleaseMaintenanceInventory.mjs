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

const POLICY_RUNTIME_RELEASE_MAINTENANCE_INVENTORY_VERSION =
  'policy.runtime_release_maintenance_inventory.v1';

const POLICY_RUNTIME_RELEASE_MAINTENANCE_INVENTORY_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED: 'blocked',
});

const SOURCE_MUTATION_CAPABILITIES = Object.freeze([
  Object.freeze({
    capabilityId: 'controlled_file_removal_apply',
    modulePath: 'server/src/services/policyControlledRemovalFileApplyAdapter.mjs',
    decisionId: 'release_maintenance_only',
    releaseMaintenanceEntryPaths: Object.freeze([
      'scripts/generate-policy-controlled-removal-apply.mjs',
    ]),
  }),
  Object.freeze({
    capabilityId: 'controlled_named_scope_source_writer',
    modulePath:
      'server/src/services/policyControlledCompatibilityNamedScopeRemovalApplySourceWriter.mjs',
    decisionId: 'decommission',
    releaseMaintenanceEntryPaths: Object.freeze([]),
  }),
]);

const DECOMMISSION_CANDIDATES = Object.freeze([
  Object.freeze({
    modulePath:
      'server/src/services/policyControlledCompatibilityNamedScopeRemovalApplySourceWriter.mjs',
    reasonId: 'source_mutation_is_not_an_application_runtime_capability',
  }),
  Object.freeze({
    modulePath:
      'server/src/services/policyControlledCompatibilityNamedScopeRemovalProductionAdmission.mjs',
    reasonId: 'production_admission_composes_a_source_mutation_capability',
  }),
]);

const RESOLVABLE_EXTENSIONS = Object.freeze(['.mjs', '.js', '.vue']);

function normalizeRepoPath(value = '') {
  return String(value).trim().replaceAll('\\', '/').replace(/^\/+/, '');
}

function asRepositoryFileMap(files = []) {
  return new Map(
    files
      .filter(file => file && typeof file.path === 'string' && typeof file.content === 'string')
      .map(file => [normalizeRepoPath(file.path), file.content])
  );
}

function pathsWithin(filePaths, rootPath) {
  const normalizedRootPath = normalizeRepoPath(rootPath).replace(/\/$/, '');

  return filePaths.filter(filePath => (
    filePath === normalizedRootPath || filePath.startsWith(`${normalizedRootPath}/`)
  ));
}

function maskComments(source = '') {
  let state = 'code';
  let escaped = false;
  let masked = '';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (state === 'line-comment') {
      if (character === '\n' || character === '\r') {
        state = 'code';
        masked += character;
      } else {
        masked += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (character === '*' && nextCharacter === '/') {
        masked += '  ';
        index += 1;
        state = 'code';
      } else {
        masked += character === '\n' || character === '\r' ? character : ' ';
      }
      continue;
    }

    if (state === 'single-quote' || state === 'double-quote' || state === 'template') {
      masked += character;
      if (!escaped && (
        (state === 'single-quote' && character === "'") ||
        (state === 'double-quote' && character === '"') ||
        (state === 'template' && character === '`')
      )) {
        state = 'code';
      }
      escaped = !escaped && character === '\\';
      if (character !== '\\') {
        escaped = false;
      }
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      masked += '  ';
      index += 1;
      state = 'line-comment';
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      masked += '  ';
      index += 1;
      state = 'block-comment';
      continue;
    }

    masked += character;
    if (character === "'") {
      state = 'single-quote';
    } else if (character === '"') {
      state = 'double-quote';
    } else if (character === '`') {
      state = 'template';
    }
  }

  return masked;
}

function collectModuleSpecifiers(source = '') {
  const maskedSource = maskComments(source);
  const patterns = [
    /\bimport\s+(?:[\w${},*\s]+?\s+from\s+)?(['"])([^'"\n]+)\1/g,
    /\bexport\s+(?:[\w${},*\s]+?\s+from\s+)(['"])([^'"\n]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
  ];

  return [...new Set(patterns.flatMap(pattern => (
    [...maskedSource.matchAll(pattern)].map(match => match[2])
  )))].sort((left, right) => left.localeCompare(right));
}

function resolveRelativeModulePath({ fromPath, specifier, filePathSet }) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const basePath = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
  const candidatePaths = [
    basePath,
    ...RESOLVABLE_EXTENSIONS.map(extension => `${basePath}${extension}`),
    ...RESOLVABLE_EXTENSIONS.map(extension => `${basePath}/index${extension}`),
  ];

  return candidatePaths.find(candidatePath => filePathSet.has(candidatePath)) || null;
}

function buildImportGraph(fileMap) {
  const filePathSet = new Set(fileMap.keys());

  return new Map([...fileMap.entries()].map(([filePath, content]) => [
    filePath,
    collectModuleSpecifiers(content)
      .map(specifier => resolveRelativeModulePath({
        fromPath: filePath,
        specifier,
        filePathSet,
      }))
      .filter(Boolean),
  ]));
}

function findImportChains({ graph, rootPaths = [], targetPath }) {
  const sortedRootPaths = [...new Set(rootPaths)].sort((left, right) => left.localeCompare(right));
  const chains = [];

  sortedRootPaths.forEach(rootPath => {
    if (!graph.has(rootPath)) {
      return;
    }

    const queue = [[rootPath]];
    const visited = new Set([rootPath]);
    while (queue.length > 0) {
      const currentChain = queue.shift();
      const currentPath = currentChain.at(-1);

      if (currentPath === targetPath) {
        chains.push(currentChain);
        break;
      }

      (graph.get(currentPath) || []).forEach(importedPath => {
        if (!visited.has(importedPath)) {
          visited.add(importedPath);
          queue.push([...currentChain, importedPath]);
        }
      });
    }
  });

  return chains;
}

function buildRuntimeSurfaces(filePaths) {
  return [
    {
      surfaceId: 'server_bootstrap',
      rootPaths: filePaths.includes('server/src/index.mjs') ? ['server/src/index.mjs'] : [],
    },
    {
      surfaceId: 'server_routes',
      rootPaths: pathsWithin(filePaths, 'server/src/routes'),
    },
    {
      surfaceId: 'server_scheduler',
      rootPaths: filePaths.includes('server/src/services/scheduler.mjs')
        ? ['server/src/services/scheduler.mjs']
        : [],
    },
    {
      surfaceId: 'server_environment_entry',
      rootPaths: pathsWithin(filePaths, 'server/src/config'),
    },
    {
      surfaceId: 'client_bootstrap',
      rootPaths: filePaths.includes('client/src/main.js') ? ['client/src/main.js'] : [],
    },
    {
      surfaceId: 'client_api',
      rootPaths: pathsWithin(filePaths, 'client/src/api'),
    },
  ];
}

function findProductionServiceImporters({ graph, targetPath }) {
  return [...graph.entries()]
    .filter(([filePath, imports]) => (
      filePath.startsWith('server/src/services/') && imports.includes(targetPath)
    ))
    .map(([filePath]) => filePath)
    .sort((left, right) => left.localeCompare(right));
}

function buildCapabilityInventory({ capability, graph, runtimeSurfaces }) {
  const moduleStateId = graph.has(capability.modulePath) ? 'present' : 'removed';
  const runtimeReachability = runtimeSurfaces.flatMap(surface => (
    findImportChains({
      graph,
      rootPaths: surface.rootPaths,
      targetPath: capability.modulePath,
    }).map(chain => ({ chain, surfaceId: surface.surfaceId }))
  ));
  const releaseMaintenanceOwnership = capability.releaseMaintenanceEntryPaths.map(entryPath => ({
    entryPath,
    chains: findImportChains({
      graph,
      rootPaths: [entryPath],
      targetPath: capability.modulePath,
    }),
  }));

  return {
    capabilityId: capability.capabilityId,
    decisionId: capability.decisionId,
    modulePath: capability.modulePath,
    moduleStateId,
    productionServiceImporters: findProductionServiceImporters({
      graph,
      targetPath: capability.modulePath,
    }),
    releaseMaintenanceOwnership,
    runtimeReachability,
  };
}

function buildValidation({ capabilities }) {
  const issues = [];

  capabilities.forEach(capability => {
    capability.runtimeReachability.forEach(reachability => {
      issues.push({
        capabilityId: capability.capabilityId,
        chain: reachability.chain,
        issueId: 'runtime_surface_reaches_source_mutator',
        surfaceId: reachability.surfaceId,
      });
    });

    if (capability.decisionId === 'release_maintenance_only' &&
        capability.moduleStateId === 'present' &&
        !capability.releaseMaintenanceOwnership.some(ownership => ownership.chains.length > 0)) {
      issues.push({
        capabilityId: capability.capabilityId,
        issueId: 'release_maintenance_owner_missing',
      });
    }
  });

  return {
    issues,
    issueIds: [...new Set(issues.map(issue => issue.issueId))]
      .sort((left, right) => left.localeCompare(right)),
    ok: issues.length === 0,
  };
}

function buildPolicyRuntimeReleaseMaintenanceInventory({
  files = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const fileMap = asRepositoryFileMap(files);
  const filePaths = [...fileMap.keys()].sort((left, right) => left.localeCompare(right));
  const graph = buildImportGraph(fileMap);
  const runtimeSurfaces = buildRuntimeSurfaces(filePaths);
  const capabilities = SOURCE_MUTATION_CAPABILITIES.map(capability => (
    buildCapabilityInventory({ capability, graph, runtimeSurfaces })
  ));
  const validation = buildValidation({ capabilities });
  const complete = validation.ok;

  return {
    version: POLICY_RUNTIME_RELEASE_MAINTENANCE_INVENTORY_VERSION,
    generatedAt,
    statusId: complete
      ? POLICY_RUNTIME_RELEASE_MAINTENANCE_INVENTORY_STATUS_IDS.COMPLETE
      : POLICY_RUNTIME_RELEASE_MAINTENANCE_INVENTORY_STATUS_IDS.BLOCKED,
    complete,
    capabilities,
    decommissionCandidates: DECOMMISSION_CANDIDATES.map(candidate => ({
      ...candidate,
      moduleStateId: graph.has(candidate.modulePath) ? 'present_pending_decommission' : 'removed',
      productionServiceImporters: findProductionServiceImporters({
        graph,
        targetPath: candidate.modulePath,
      }),
    })),
    runtimeSurfaces: runtimeSurfaces.map(surface => ({
      rootPaths: surface.rootPaths,
      surfaceId: surface.surfaceId,
    })),
    summary: {
      decommissionCandidateCount: DECOMMISSION_CANDIDATES.length,
      releaseMaintenanceOwnedCapabilityCount: capabilities.filter(capability => (
        capability.decisionId === 'release_maintenance_only'
      )).length,
      runtimeReachabilityCount: capabilities.reduce((count, capability) => (
        count + capability.runtimeReachability.length
      ), 0),
      sourceMutationCapabilityCount: SOURCE_MUTATION_CAPABILITIES.length,
    },
    validation,
    sideEffects: {
      filesRead: false,
      filesWritten: false,
      networkAccessed: false,
      sourceMutationCapabilityInvoked: false,
      storageChanged: false,
    },
    nextAction: complete
      ? {
        actionId: 'decommission_server_resident_source_mutation_path',
        resultId: 'server_source_mutation_decommission_pending',
      }
      : {
        actionId: 'remove_runtime_reachability_or_restore_release_maintenance_owner',
        resultId: 'runtime_boundary_violation',
      },
  };
}

export {
  DECOMMISSION_CANDIDATES,
  POLICY_RUNTIME_RELEASE_MAINTENANCE_INVENTORY_STATUS_IDS,
  POLICY_RUNTIME_RELEASE_MAINTENANCE_INVENTORY_VERSION,
  SOURCE_MUTATION_CAPABILITIES,
  buildPolicyRuntimeReleaseMaintenanceInventory,
  collectModuleSpecifiers,
};
