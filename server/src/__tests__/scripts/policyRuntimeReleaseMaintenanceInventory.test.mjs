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
  RETIRED_SOURCE_MUTATION_MODULE_PATHS,
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

function fixtureFiles({
  includeRetiredCommand = false,
  includeRetiredEntry = false,
  routeImportsWriter = false,
  retiredModulePaths = [],
  workflowPermission = null,
} = {}) {
  return [
    ...retiredModulePaths.map(modulePath => ({
      path: modulePath,
      content: 'export const retiredNamedScopeModule = true;\n',
    })),
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
    {
      path: 'package.json',
      content: JSON.stringify({
        scripts: includeRetiredCommand
          ? { 'policy:controlled-removal-apply': 'node scripts/generate-policy-controlled-removal-apply.mjs' }
          : {},
      }),
    },
    ...(workflowPermission ? [{
      path: '.github/workflows/retirement.yml',
      content: `${workflowPermission}\n`,
    }] : []),
    ...(includeRetiredEntry ? [{
      path: RELEASE_MAINTENANCE_SCRIPT,
      content: 'export const retiredReleaseMaintenanceEntry = true;\n',
    }] : []),
  ];
}

describe('policy runtime release-maintenance inventory', () => {
  test('records the complete CI validation-only retirement boundary', () => {
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
        resultId: 'closure_map_reconciliation_pending',
      }),
      scanScope: 'repository',
      sideEffects: expect.objectContaining({
        filesRead: true,
        filesWritten: false,
        networkAccessed: false,
        sourceMutationCapabilityInvoked: false,
      }),
      summary: expect.objectContaining({
        activeSourceMutationCapabilityCount: 0,
        decommissionCandidateCount: RETIRED_SOURCE_MUTATION_MODULE_PATHS.length,
        presentRetiredSourceMutationModuleCount: 0,
        retiredReleaseMaintenanceCommandCount: 1,
        retiredReleaseMaintenanceEntryCount: 1,
        retiredSourceMutationModuleCount: RETIRED_SOURCE_MUTATION_MODULE_PATHS.length,
        cataloguedRetiredSourceMutationCapabilityCount: 2,
        runtimeReachabilityCount: 0,
        workflowWritePermissionCount: 0,
      }),
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(fileApplyCapability).toEqual(expect.objectContaining({
      decisionId: 'decommission',
      moduleStateId: 'removed',
      releaseMaintenanceOwnership: [],
      runtimeReachability: [],
    }));
    expect(namedScopeWriterCapability).toEqual(expect.objectContaining({
      decisionId: 'decommission',
      moduleStateId: 'removed',
      productionServiceImporters: [],
      runtimeReachability: [],
    }));
    expect(JSON.stringify(inventory)).not.toContain(REPOSITORY_ROOT);
  });

  test('fails closed when a retired source-mutation module is reintroduced', () => {
    const inventory = buildPolicyRuntimeReleaseMaintenanceInventory({
      files: fixtureFiles({ retiredModulePaths: [PRODUCTION_ADMISSION] }),
      generatedAt: GENERATED_AT,
    });

    expect(inventory).toEqual(expect.objectContaining({
      complete: false,
      nextAction: expect.objectContaining({
        resultId: 'ci_only_retirement_command_contract_violation',
      }),
      validation: expect.objectContaining({
        issueIds: ['retired_source_mutation_module_present'],
        ok: false,
      }),
    }));
    expect(inventory.validation.issues).toContainEqual(expect.objectContaining({
      issueId: 'retired_source_mutation_module_present',
      modulePath: PRODUCTION_ADMISSION,
    }));
  });

  test('records both violations when a route reaches a reintroduced source writer', () => {
    const inventory = buildPolicyRuntimeReleaseMaintenanceInventory({
      files: fixtureFiles({
        retiredModulePaths: [NAMED_SCOPE_SOURCE_WRITER],
        routeImportsWriter: true,
      }),
      generatedAt: GENERATED_AT,
    });

    expect(inventory.validation.issueIds).toEqual([
      'retired_source_mutation_module_present',
      'runtime_surface_reaches_source_mutator',
    ]);
    expect(inventory.validation.issues).toContainEqual(expect.objectContaining({
      capabilityId: 'controlled_named_scope_source_writer',
      chain: ['server/src/routes/policies.mjs', NAMED_SCOPE_SOURCE_WRITER],
      issueId: 'runtime_surface_reaches_source_mutator',
      surfaceId: 'server_routes',
    }));
  });

  test('fails closed when the retired command or entry script is reintroduced', () => {
    const inventory = buildPolicyRuntimeReleaseMaintenanceInventory({
      files: fixtureFiles({
        includeRetiredCommand: true,
        includeRetiredEntry: true,
      }),
      generatedAt: GENERATED_AT,
    });

    expect(inventory).toEqual(expect.objectContaining({
      complete: false,
      validation: expect.objectContaining({
        issueIds: [
          'retired_release_maintenance_command_present',
          'retired_release_maintenance_entry_present',
        ],
        ok: false,
      }),
    }));
  });

  test.each([
    ['contents: write', 'contents_write'],
    ['permissions: write-all', 'write_all'],
    ['permissions: { contents: write }', 'contents_write'],
  ])('fails closed when a workflow declares %s', (workflowPermission, permissionId) => {
    const inventory = buildPolicyRuntimeReleaseMaintenanceInventory({
      files: fixtureFiles({ workflowPermission }),
      generatedAt: GENERATED_AT,
    });

    expect(inventory.validation.issueIds).toEqual([
      'repository_workflow_write_permission_present',
    ]);
    expect(inventory.validation.issues).toContainEqual(expect.objectContaining({
      issueId: 'repository_workflow_write_permission_present',
      permissionId,
      workflowPath: '.github/workflows/retirement.yml',
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
