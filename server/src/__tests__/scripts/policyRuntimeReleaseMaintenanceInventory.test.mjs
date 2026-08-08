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
  collectModuleSpecifiers,
} from '../../../../scripts/lib/policyRuntimeReleaseMaintenanceInventory.mjs';
import {
  buildPolicyRuntimeReleaseMaintenanceRepositoryInventory,
} from '../../../../scripts/lib/policyRuntimeReleaseMaintenanceRepositoryScan.mjs';
import { fileURLToPath } from 'node:url';

const GENERATED_AT = '2026-08-08T00:00:00.000Z';
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const FILE_APPLY_ADAPTER =
  'server/src/services/policyControlledRemovalFileApplyAdapter.mjs';
const NAMED_SCOPE_SOURCE_WRITER =
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalApplySourceWriter.mjs';
const PRODUCTION_ADMISSION =
  'server/src/services/policyControlledCompatibilityNamedScopeRemovalProductionAdmission.mjs';
const RELEASE_MAINTENANCE_SCRIPT = 'scripts/generate-policy-controlled-removal-apply.mjs';

function fixtureFiles({ includeReleaseMaintenanceOwner = true, routeImportsWriter = false } = {}) {
  return [
    {
      path: FILE_APPLY_ADAPTER,
      content: 'export function createFileApplyAdapter() {}\n',
    },
    {
      path: NAMED_SCOPE_SOURCE_WRITER,
      content: 'export function createSourceWriter() {}\n',
    },
    {
      path: PRODUCTION_ADMISSION,
      content: `import { createSourceWriter } from './${NAMED_SCOPE_SOURCE_WRITER.split('/').at(-1)}';\n`,
    },
    {
      path: 'server/src/routes/policies.mjs',
      content: routeImportsWriter
        ? `import { createSourceWriter } from '../services/${NAMED_SCOPE_SOURCE_WRITER.split('/').at(-1)}';\n`
        : 'export const policyRoutes = [];\n',
    },
    {
      path: 'server/src/index.mjs',
      content: "import './routes/policies.mjs';\n",
    },
    {
      path: 'server/src/services/scheduler.mjs',
      content: 'export function schedule() {}\n',
    },
    {
      path: 'server/src/config/environment.mjs',
      content: 'export const environment = {};\n',
    },
    {
      path: 'client/src/main.js',
      content: "import './api/index.js';\n",
    },
    {
      path: 'client/src/api/index.js',
      content: 'export const api = {};\n',
    },
    ...(includeReleaseMaintenanceOwner ? [{
      path: RELEASE_MAINTENANCE_SCRIPT,
      content: `import { createFileApplyAdapter } from '../${FILE_APPLY_ADAPTER}';\n`,
    }] : []),
  ];
}

describe('policy runtime release-maintenance inventory', () => {
  test('records the current repository boundary without local checkout data', () => {
    const inventory = buildPolicyRuntimeReleaseMaintenanceRepositoryInventory({
      generatedAt: GENERATED_AT,
      rootDir: REPOSITORY_ROOT,
    });
    const fileApplyCapability = inventory.capabilities.find(capability => (
      capability.modulePath === FILE_APPLY_ADAPTER
    ));
    const namedScopeWriterCapability = inventory.capabilities.find(capability => (
      capability.modulePath === NAMED_SCOPE_SOURCE_WRITER
    ));

    expect(inventory).toEqual(expect.objectContaining({
      complete: true,
      generatedAt: GENERATED_AT,
      nextAction: expect.objectContaining({
        resultId: 'server_source_mutation_decommission_pending',
      }),
      scanScope: 'repository',
      sideEffects: expect.objectContaining({
        filesRead: true,
        filesWritten: false,
        networkAccessed: false,
        sourceMutationCapabilityInvoked: false,
      }),
      summary: expect.objectContaining({
        decommissionCandidateCount: 2,
        runtimeReachabilityCount: 0,
        sourceMutationCapabilityCount: 2,
      }),
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(fileApplyCapability).toEqual(expect.objectContaining({
      decisionId: 'release_maintenance_only',
      moduleStateId: 'present',
      releaseMaintenanceOwnership: [{
        entryPath: RELEASE_MAINTENANCE_SCRIPT,
        chains: [[RELEASE_MAINTENANCE_SCRIPT, FILE_APPLY_ADAPTER]],
      }],
      runtimeReachability: [],
    }));
    expect(namedScopeWriterCapability).toEqual(expect.objectContaining({
      decisionId: 'decommission',
      moduleStateId: 'present',
      productionServiceImporters: [PRODUCTION_ADMISSION],
      runtimeReachability: [],
    }));
    expect(JSON.stringify(inventory)).not.toContain(REPOSITORY_ROOT);
  });

  test('fails closed when a route can reach a source-mutating module', () => {
    const inventory = buildPolicyRuntimeReleaseMaintenanceInventory({
      files: fixtureFiles({ routeImportsWriter: true }),
      generatedAt: GENERATED_AT,
    });

    expect(inventory).toEqual(expect.objectContaining({
      complete: false,
      nextAction: expect.objectContaining({ resultId: 'runtime_boundary_violation' }),
      validation: expect.objectContaining({
        issueIds: ['runtime_surface_reaches_source_mutator'],
        ok: false,
      }),
    }));
    expect(inventory.validation.issues).toContainEqual(expect.objectContaining({
      capabilityId: 'controlled_named_scope_source_writer',
      chain: ['server/src/routes/policies.mjs', NAMED_SCOPE_SOURCE_WRITER],
      issueId: 'runtime_surface_reaches_source_mutator',
      surfaceId: 'server_routes',
    }));
  });

  test('fails closed when the retained mutation capability loses its maintenance owner', () => {
    const inventory = buildPolicyRuntimeReleaseMaintenanceInventory({
      files: fixtureFiles({ includeReleaseMaintenanceOwner: false }),
      generatedAt: GENERATED_AT,
    });

    expect(inventory).toEqual(expect.objectContaining({
      complete: false,
      validation: expect.objectContaining({
        issueIds: ['release_maintenance_owner_missing'],
        ok: false,
      }),
    }));
  });

  test('does not treat comments as executable imports', () => {
    expect(collectModuleSpecifiers(`
      // import './commented-out.mjs';
      /* export { value } from './also-commented-out.mjs'; */
      import { value } from './real-module.mjs';
    `)).toEqual(['./real-module.mjs']);
  });
});
