/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';

import {
  loadPolicyLibraryRebuildLegacyDeletionEvidence,
} from '../../services/policyLibraryRebuildLegacyDeletionReadinessRepository.mjs';

function createClient() {
  const calls = [];

  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('FROM library_policies')) {
        return { rows: [{ id: 44, library_id: 6 }] };
      }
      if (sql.includes('FROM policy_library_rebuild_execution_gates')) {
        return { rows: [{
          id: 801,
          verification_run_id: 701,
          rollback_snapshot_id: 901,
          replacement_event_id: 303,
        }] };
      }
      if (sql.includes('FROM policy_migration_verification_runs')) {
        return { rows: [{ id: 701 }] };
      }
      if (sql.includes('FROM policy_intent_rollback_snapshots')) {
        return { rows: [{ id: 901 }] };
      }
      if (sql.includes('FROM policy_intent_migration_events')) {
        return { rows: [{ id: 303 }] };
      }
      if (sql.includes('FROM policy_intents')) {
        return { rows: [{ id: 202, policy_id: 44, library_id: 6 }] };
      }

      throw new Error(`Unexpected readiness query: ${sql}`);
    },
  };
}

describe('policyLibraryRebuildLegacyDeletionReadinessRepository', () => {
  test('loads only compact provenance under shared locks in writer-compatible order', async () => {
    const client = createClient();

    const evidence = await loadPolicyLibraryRebuildLegacyDeletionEvidence({ client, policyId: 44 });

    expect(evidence).toEqual({
      policy: { id: 44, library_id: 6 },
      executionGate: expect.objectContaining({ id: 801 }),
      verificationReceipt: { id: 701 },
      rollbackSnapshot: { id: 901 },
      replacementEvent: { id: 303 },
      activeNativeIntents: [{ id: 202, policy_id: 44, library_id: 6 }],
    });
    expect(client.calls.map(call => call.sql)).toEqual(expect.arrayContaining([
      expect.stringContaining('FROM library_policies'),
      expect.stringContaining('FROM policy_library_rebuild_execution_gates'),
      expect.stringContaining('FROM policy_migration_verification_runs'),
      expect.stringContaining('FROM policy_intent_rollback_snapshots'),
      expect.stringContaining('FROM policy_intent_migration_events'),
      expect.stringContaining('FROM policy_intents'),
    ]));
    expect(client.calls.map(call => call.sql)).toEqual(
      expect.arrayContaining([expect.stringMatching(/FOR SHARE/u)]),
    );
    expect(client.calls.findIndex(call => call.sql.includes('FROM library_policies'))).toBe(0);
    expect(client.calls.findIndex(call => call.sql.includes('FROM policy_library_rebuild_execution_gates')))
      .toBe(1);
    expect(client.calls.find(call => call.sql.includes('FROM policy_intents')).sql)
      .toContain("source = 'native_intent'");
    expect(client.calls.some(call => /INSERT|UPDATE|DELETE/iu.test(call.sql))).toBe(false);
  });

  test('returns an empty compact boundary for an invalid or absent policy', async () => {
    const invalidClient = { query: jest.fn() };
    const missingClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    await expect(loadPolicyLibraryRebuildLegacyDeletionEvidence({
      client: invalidClient,
      policyId: 'invalid',
    })).resolves.toEqual({
      policy: null,
      executionGate: null,
      verificationReceipt: null,
      rollbackSnapshot: null,
      replacementEvent: null,
      activeNativeIntents: [],
    });
    expect(invalidClient.query).not.toHaveBeenCalled();

    await expect(loadPolicyLibraryRebuildLegacyDeletionEvidence({
      client: missingClient,
      policyId: 44,
    })).resolves.toEqual({
      policy: null,
      executionGate: null,
      verificationReceipt: null,
      rollbackSnapshot: null,
      replacementEvent: null,
      activeNativeIntents: [],
    });
    expect(missingClient.query).toHaveBeenCalledTimes(1);
  });
});
