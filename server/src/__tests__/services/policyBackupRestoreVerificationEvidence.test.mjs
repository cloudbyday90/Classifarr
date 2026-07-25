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
  POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS,
  POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS,
  buildPolicyBackupRestoreVerificationEvidence,
  loadPolicyBackupRestoreVerificationEvidence,
  validatePolicyBackupRestoreVerificationEvidence,
} from '../../services/policyBackupRestoreVerificationEvidence.mjs';

const GENERATED_AT = '2026-07-25T12:00:00.000Z';

function verificationRecord(overrides = {}) {
  return {
    verification_version: 1,
    restore_mode: 'replace',
    backup_version: '2.0',
    verification_status: 'verified',
    schema_parity_verified: true,
    native_authority_verified: true,
    policy_library_mismatch_count: 0,
    verified_at: GENERATED_AT,
    restore_gate_state: 'ready',
    restore_gate_reason_id: 'restore_verified',
    restore_gate_verified_at: GENERATED_AT,
    ...overrides,
  };
}

describe('policyBackupRestoreVerificationEvidence', () => {
  test('proves a recent verified restore from bounded database facts', () => {
    const evidence = buildPolicyBackupRestoreVerificationEvidence({
      record: verificationRecord(),
      generatedAt: GENERATED_AT,
    });

    expect(evidence.statusId)
      .toBe(POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.VERIFIED);
    expect(evidence.backupRestoreVerified).toBe(true);
    expect(evidence.verification).toEqual({
      latestVerifiedAt: GENERATED_AT,
      maximumVerificationAgeMs: 24 * 60 * 60 * 1000,
      rawBackupPayloadExposed: false,
      backupPathExposed: false,
      backupFilenameExposed: false,
    });
    expect(evidence.validation.ok).toBe(true);
  });

  test('fails closed for missing, stale, invalid, or disconnected restore records', () => {
    const missing = buildPolicyBackupRestoreVerificationEvidence({
      generatedAt: GENERATED_AT,
    });
    const stale = buildPolicyBackupRestoreVerificationEvidence({
      record: verificationRecord({ verified_at: '2026-07-24T11:59:59.999Z' }),
      generatedAt: GENERATED_AT,
    });
    const invalid = buildPolicyBackupRestoreVerificationEvidence({
      record: verificationRecord({ native_authority_verified: false }),
      generatedAt: GENERATED_AT,
    });
    const disconnected = buildPolicyBackupRestoreVerificationEvidence({
      record: verificationRecord({ restore_gate_verified_at: '2026-07-25T11:59:59.000Z' }),
      generatedAt: GENERATED_AT,
    });

    expect(missing.statusId)
      .toBe(POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.BLOCKED_BY_MISSING_VERIFICATION);
    expect(stale.statusId)
      .toBe(POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.BLOCKED_BY_STALE_VERIFICATION);
    expect(invalid.statusId)
      .toBe(POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.INVALID_EVIDENCE);
    expect(disconnected.statusId)
      .toBe(POLICY_BACKUP_RESTORE_VERIFICATION_STATUS_IDS.BLOCKED_BY_RESTORE_GATE);
    expect(disconnected.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS
          .RESTORE_GATE_VERIFICATION_MISMATCH,
      }),
    ]));
  });

  test('loads only safe verification and native restore-gate facts', async () => {
    const queries = [];
    const dbClient = {
      query: async query => {
        queries.push(query);
        return { rows: [verificationRecord()] };
      },
    };

    const evidence = await loadPolicyBackupRestoreVerificationEvidence(dbClient, {
      generatedAt: GENERATED_AT,
    });

    expect(evidence.backupRestoreVerified).toBe(true);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('FROM policy_backup_restore_verifications verification');
    expect(queries[0]).toContain('policy_native_intent_reconciliation_restore_gates');
    expect(queries[0]).not.toContain('filename');
    expect(queries[0]).not.toContain('path');
    expect(queries[0]).not.toContain('password');
    expect(queries[0]).not.toContain('snapshot_payload');
  });

  test('rejects altered reported side effects and risk counts', () => {
    const evidence = buildPolicyBackupRestoreVerificationEvidence({
      record: verificationRecord(),
      generatedAt: GENERATED_AT,
    });
    const validation = validatePolicyBackupRestoreVerificationEvidence({
      ...evidence,
      riskCount: 2,
      sideEffects: {
        ...evidence.sideEffects,
        databaseMutated: true,
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.RISK_COUNT_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_BACKUP_RESTORE_VERIFICATION_RISK_IDS.SIDE_EFFECT_PERFORMED,
      }),
    ]));
  });
});
