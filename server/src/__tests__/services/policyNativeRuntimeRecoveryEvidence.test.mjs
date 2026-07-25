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
  POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS,
  POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS,
  buildPolicyNativeRuntimeRecoveryEvidence,
  loadPolicyNativeRuntimeRecoveryEvidence,
} from '../../services/policyNativeRuntimeRecoveryEvidence.mjs';

const GENERATED_AT = '2026-07-25T12:00:00.000Z';

function recoveryRecord(overrides = {}) {
  return {
    policy_id: 14,
    native_intent_id: 501,
    rollback_snapshot_id: 91,
    rollback_payload_redacted: false,
    rollback_restored_at: null,
    rollback_expires_at: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('policyNativeRuntimeRecoveryEvidence', () => {
  test('proves rollback availability from current native-policy snapshot facts', () => {
    const evidence = buildPolicyNativeRuntimeRecoveryEvidence({
      generatedAt: GENERATED_AT,
      records: [recoveryRecord(), recoveryRecord({ policy_id: 15, native_intent_id: 502 })],
    });

    expect(evidence.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.ROLLBACK_AVAILABLE);
    expect(evidence.rollbackAvailable).toBe(true);
    expect(evidence.recovery).toEqual({
      assessedNativePolicyCount: 2,
      rollbackAvailablePolicyCount: 2,
      unavailablePolicyCount: 0,
      sampleUnavailablePolicyIds: [],
      rawSnapshotPayloadExposed: false,
    });
    expect(evidence.validation.ok).toBe(true);
  });

  test('fails closed for expired, restored, redacted, or missing snapshots without exposing payloads', () => {
    const evidence = buildPolicyNativeRuntimeRecoveryEvidence({
      generatedAt: GENERATED_AT,
      records: [
        recoveryRecord({ policy_id: 14, rollback_expires_at: '2026-07-25T11:59:59.999Z' }),
        recoveryRecord({ policy_id: 15, rollback_restored_at: '2026-07-24T12:00:00.000Z' }),
        recoveryRecord({ policy_id: 16, rollback_payload_redacted: true }),
        recoveryRecord({ policy_id: 17, rollback_snapshot_id: null }),
      ],
    });

    expect(evidence.statusId)
      .toBe(POLICY_NATIVE_RUNTIME_RECOVERY_STATUS_IDS.BLOCKED_BY_ROLLBACK);
    expect(evidence.rollbackAvailable).toBe(false);
    expect(evidence.recovery).toEqual(expect.objectContaining({
      assessedNativePolicyCount: 4,
      unavailablePolicyCount: 4,
      sampleUnavailablePolicyIds: [14, 15, 16, 17],
      rawSnapshotPayloadExposed: false,
    }));
    expect(evidence.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_NATIVE_RUNTIME_RECOVERY_RISK_IDS.ROLLBACK_SNAPSHOT_UNAVAILABLE,
      }),
    ]));
    expect(JSON.stringify(evidence)).not.toContain('snapshot_payload');
  });

  test('loads only bounded rollback facts for every enabled authoritative native policy', async () => {
    const queries = [];
    const dbClient = {
      query: async (query) => {
        queries.push(query);
        return {
          rows: [recoveryRecord({
            policy_id: 14,
            native_intent_id: 501,
            rollback_expires_at: '2026-08-01T12:00:00.000Z',
          })],
        };
      },
    };

    const evidence = await loadPolicyNativeRuntimeRecoveryEvidence(dbClient, {
      generatedAt: GENERATED_AT,
    });

    expect(evidence.rollbackAvailable).toBe(true);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('WITH active_intent_counts');
    expect(queries[0]).toContain('WHERE policy.enabled = TRUE');
    expect(queries[0]).toContain('FROM policy_intent_rollback_snapshots snapshot');
    expect(queries[0]).not.toContain('snapshot.snapshot_payload');
  });
});
