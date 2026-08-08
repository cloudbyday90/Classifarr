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

import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import {
  upsertNativeIntentReconciliationState,
} from '../../services/nativeIntentReconciliationStatePersistence.mjs';

let db;

function uniqueSuffix() {
  return randomUUID().replaceAll('-', '');
}

async function createLibrary({ label } = {}) {
  const suffix = uniqueSuffix();
  const result = await db.query(
    `INSERT INTO libraries (external_id, name, media_type)
     VALUES ($1, $2, 'movie')
     RETURNING id`,
    [`lifecycle-diagnostics-${label}-${suffix}`, `Lifecycle Diagnostics ${label} ${suffix}`],
  );

  return { id: result.rows[0].id, suffix };
}

async function createPolicy({ libraryId, name } = {}) {
  const result = await db.query(
    `INSERT INTO library_policies (library_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [libraryId, name],
  );

  return { id: result.rows[0].id, libraryId };
}

async function attachPreset({ policyId, key, name, signals } = {}) {
  const preset = await db.query(
    `INSERT INTO content_presets (
       key, name, description, category, signals, is_system, display_order
     )
     VALUES ($1, $2, $3, 'integration_test', $4::jsonb, TRUE, 0)
     RETURNING id`,
    [
      key,
      name,
      'Lifecycle diagnostics acceptance fixture.',
      JSON.stringify(signals),
    ],
  );
  await db.query(
    `INSERT INTO policy_presets (policy_id, preset_id, weight, sort_order)
     VALUES ($1, $2, 1, 0)`,
    [policyId, preset.rows[0].id],
  );
}

async function runReconciliationThroughScheduler() {
  const { schedulerService } = await import('../../services/scheduler.mjs');
  const { nativeIntentReconciliationService } =
    await import('../../services/nativeIntentReconciliationService.mjs');
  const { DB_ADVISORY_LOCKS } = await import('../../config/database.mjs');

  return schedulerService.runScheduledTask(
    'native-intent-lifecycle-diagnostics-release-evidence',
    () => nativeIntentReconciliationService.run(),
    DB_ADVISORY_LOCKS.NATIVE_INTENT_RECONCILIATION,
  );
}

async function readNativeRuntimePolicy(policyId) {
  const { getActivePolicies } = await import('../../services/policyEngineQueries.mjs');
  const policies = await getActivePolicies();
  return policies.find(policy => policy.id === policyId);
}

function assertBoundedStatusShape(status) {
  expect(Object.keys(status).sort()).toEqual([
    'blockerReasonGroups',
    'control',
    'evaluatedAt',
    'inventory',
    'latestRun',
    'nextScheduledAttemptAt',
    'rawPayloadExposed',
    'reasonGroupLimit',
    'recentFailedRunCount',
    'statusId',
    'version',
  ]);
  expect(Object.keys(status.inventory).sort()).toEqual([
    'blockedCurrentStateCount',
    'deferredRetryCount',
    'oldestUnresolvedAt',
    'rawPayloadExposed',
    'requiresMaintenanceCount',
    'systemFailureCount',
    'unresolvedCount',
  ]);
  expect(status.blockerReasonGroups).toEqual(expect.arrayContaining([
    expect.objectContaining({
      outcomeState: 'deferred_retry',
      reasonId: 'awaiting_library_profile',
      policyCount: 1,
      rawPayloadExposed: false,
    }),
    expect.objectContaining({
      outcomeState: 'requires_maintenance',
      reasonId: 'unsupported_legacy_shape',
      policyCount: 1,
      rawPayloadExposed: false,
    }),
  ]));
  expect(status.blockerReasonGroups).toHaveLength(2);
  expect(status.blockerReasonGroups.length).toBeLessThanOrEqual(status.reasonGroupLimit);
  expect(status.rawPayloadExposed).toBe(false);
  expect(status.inventory.rawPayloadExposed).toBe(false);
  expect(status.control.rawPayloadExposed).toBe(false);
}

beforeAll(() => {
  db = getPool();
});

describe('Native intent lifecycle diagnostics and release evidence acceptance', () => {
  test('keeps diagnostics bounded and native runtime available when compatibility retirement is blocked', async () => {
    const fixtureSecret = `lifecycle-diagnostic-secret-${uniqueSuffix()}`;
    const supportedLibrary = await createLibrary({ label: 'supported' });
    const supportedPolicy = await createPolicy({
      libraryId: supportedLibrary.id,
      name: `Supported native policy ${fixtureSecret}`,
    });
    await attachPreset({
      policyId: supportedPolicy.id,
      key: `supported-${uniqueSuffix()}`,
      name: `Supported preset ${fixtureSecret}`,
      signals: { genres: { require_any: ['Family'] } },
    });

    const invalidLibrary = await createLibrary({ label: 'unsupported' });
    const invalidPolicy = await createPolicy({
      libraryId: invalidLibrary.id,
      name: `Unsupported policy ${fixtureSecret}`,
    });
    await attachPreset({
      policyId: invalidPolicy.id,
      key: `unsupported-${uniqueSuffix()}`,
      name: `Unsupported preset ${fixtureSecret}`,
      signals: {
        unsupported_signal: { require_any: [fixtureSecret] },
      },
    });

    const deferredLibrary = await createLibrary({ label: 'deferred' });
    const deferredPolicy = await createPolicy({
      libraryId: deferredLibrary.id,
      name: `Deferred policy ${fixtureSecret}`,
    });

    expect(await runReconciliationThroughScheduler()).toBe(true);
    await upsertNativeIntentReconciliationState({
      client: db,
      state: {
        policyId: deferredPolicy.id,
        candidateFingerprint: `sha256:${'d'.repeat(64)}`,
        candidateStatusId: 'awaiting_library_profile',
        outcomeState: 'deferred_retry',
        reasonId: 'awaiting_library_profile',
        retryNotBefore: '2030-01-01T00:00:00.000Z',
        failureCount: 0,
        evaluatedAt: '2026-08-08T12:00:00.000Z',
      },
    });

    const nativeRuntimeBefore = await readNativeRuntimePolicy(supportedPolicy.id);
    expect(nativeRuntimeBefore).toEqual(expect.objectContaining({
      presets: [],
      policy_runtime_authority: expect.objectContaining({
        sourceId: 'native_intent',
        validationOk: true,
      }),
      policy_intent_contract: expect.objectContaining({
        source: 'native_intent',
        purpose: expect.arrayContaining([expect.objectContaining({
          signal_type: 'genres',
          values: { require_any: ['Family'] },
        })]),
      }),
    }));

    const { nativeIntentReconciliationStatusService } =
      await import('../../services/nativeIntentReconciliationStatusService.mjs');
    const { loadPolicyCompatibilityDeletionReconciliationStateInventory } =
      await import('../../services/policyCompatibilityDeletionReconciliationStateInventory.mjs');
    const {
      POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS,
      buildPolicyStorageFinalClosureReadout,
    } = await import('../../services/policyStorageFinalClosureReadout.mjs');

    const [status, retirementInventory, closureReadout] = await Promise.all([
      nativeIntentReconciliationStatusService.getStatus({
        dbClient: db,
        now: '2026-08-08T12:30:00.000Z',
      }),
      loadPolicyCompatibilityDeletionReconciliationStateInventory(db, {
        generatedAt: '2026-08-08T12:30:00.000Z',
      }),
      buildPolicyStorageFinalClosureReadout({
        checkpointArtifact: {},
        generatedAt: '2026-08-08T12:30:00.000Z',
      }),
    ]);

    expect(status).toEqual(expect.objectContaining({
      statusId: 'attention_required',
      inventory: expect.objectContaining({
        unresolvedCount: 2,
        deferredRetryCount: 1,
        requiresMaintenanceCount: 1,
        blockedCurrentStateCount: 0,
        systemFailureCount: 0,
      }),
    }));
    assertBoundedStatusShape(status);

    expect(retirementInventory).toEqual(expect.objectContaining({
      statusId: 'blocked_by_requires_maintenance_states',
      hasNoRequiresMaintenanceStates: false,
      requiresMaintenanceStateCount: 1,
      collectionPolicy: {
        readsCurrentDatabaseState: true,
        countsOnlyUnresolvedStates: true,
        includesPolicyIds: false,
        includesFailureReasons: false,
        writesDatabase: false,
        deletesData: false,
      },
      sideEffects: {
        writesDatabase: false,
        writesFiles: false,
        mutatesSchema: false,
        deletesData: false,
      },
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(closureReadout).toEqual(expect.objectContaining({
      statusId: POLICY_STORAGE_FINAL_CLOSURE_READOUT_STATUS_IDS.BLOCKED_BY_ARTIFACT_VALIDATION,
      complete: false,
      sideEffects: {
        filesWritten: false,
        storageChanged: false,
        gitCommandsRun: false,
        commandsExecuted: false,
        manifestWritten: false,
      },
      validation: expect.objectContaining({ ok: true }),
    }));

    const diagnosticOutputs = JSON.stringify({ status, retirementInventory, closureReadout });
    expect(diagnosticOutputs).not.toContain(fixtureSecret);
    expect(diagnosticOutputs).not.toMatch(/"(?:policy|library)(?:_id|Id)"\s*:/u);
    expect(diagnosticOutputs).not.toMatch(
      /"(?:signals|presets|providerPayload|provider_payload)"\s*:/u,
    );

    const nativeRuntimeAfter = await readNativeRuntimePolicy(supportedPolicy.id);
    expect(nativeRuntimeAfter).toEqual(nativeRuntimeBefore);
  });
});
