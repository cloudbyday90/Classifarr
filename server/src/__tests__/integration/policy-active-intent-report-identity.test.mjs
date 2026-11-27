/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import {
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS as status,
  loadPolicyActiveIntentIntegrityReport,
} from '../../services/policyActiveIntentIntegrity.mjs';
import { buildPolicyCandidateAuthorityEligibility } from '../../services/policyCandidateAuthorityEligibility.mjs';
import { NativeIntentReconciliationLifecycleService } from '../../services/nativeIntentReconciliationLifecycleService.mjs';

test('keeps legacy duplicate IDs exact through integrity and reconciliation reads', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // Model rows that the current single-active-intent index prevents.
    await client.query(`
      CREATE TEMP TABLE policy_intents (
        id bigint PRIMARY KEY,
        policy_id integer NOT NULL,
        library_id integer NOT NULL,
        intent_version integer NOT NULL,
        validation_status text NOT NULL,
        active boolean NOT NULL DEFAULT TRUE,
        accepted_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      ) ON COMMIT DROP;
      CREATE TEMP TABLE library_policies (
        id integer PRIMARY KEY,
        library_id integer NOT NULL
      ) ON COMMIT DROP;
      INSERT INTO pg_temp.library_policies VALUES (1, 10), (2, 20), (3, 30);
      INSERT INTO pg_temp.policy_intents
        (id, policy_id, library_id, intent_version, validation_status, active)
      VALUES
        (9007199254740993, 1, 10, 3, 'valid', TRUE),
        (9007199254740992, 1, 10, 2, 'valid', TRUE),
        (9223372036854775807, 1, 10, 5, 'warning', TRUE),
        (10000000000000000, 1, 10, 4, 'warning', TRUE),
        (11, 1, 10, 1, 'valid', TRUE),
        (0, 2, 20, 2, 'valid', TRUE),
        (12, 2, 20, 1, 'valid', TRUE),
        (13, 3, 30, 1, 'valid', TRUE),
        (14, 3, 30, 2, 'valid', FALSE);
    `);

    const report = await loadPolicyActiveIntentIntegrityReport(client);
    expect(report).toMatchObject({
      statusId: status.BLOCKED_UNSAFE_DUPLICATE,
      duplicatePolicyCount: 2,
      repairableCount: 1,
      blockedCount: 1,
    });
    expect(JSON.parse(JSON.stringify(report.findings))).toEqual([
      {
        policyId: 1,
        statusId: status.REPAIRABLE_DUPLICATE,
        activeIntentCount: 5,
        canonicalIntentId: '9007199254740993',
        canonicalIntentVersion: 3,
        duplicateIntentIds: [11, '9007199254740992', '10000000000000000', '9223372036854775807'],
        activeIntentIds: [11, '9007199254740992', '9007199254740993', '10000000000000000', '9223372036854775807'],
      },
      {
        policyId: 2,
        statusId: status.BLOCKED_UNSAFE_DUPLICATE,
        activeIntentCount: 2,
        canonicalIntentId: null,
        canonicalIntentVersion: null,
        duplicateIntentIds: [12],
        activeIntentIds: [12],
      },
    ]);
    const eligibility = policyId => buildPolicyCandidateAuthorityEligibility({
      policyId,
      activeIntentIntegrityReport: report,
    });
    expect(eligibility(1)).toMatchObject({ eligible: false, activeIntentCount: 5 });
    expect(eligibility(2)).toMatchObject({ eligible: false, activeIntentCount: 2 });
    expect(eligibility(3)).toMatchObject({ eligible: true });

    const lifecycle = new NativeIntentReconciliationLifecycleService();
    expect(await lifecycle.verifyRestoredDatabase({ dbClient: client })).toMatchObject({
      verified: false,
      schemaParity: true,
      nativeAuthorityIntegrity: false,
      policyLibraryMismatchCount: 0,
    });
    expect(await loadPolicyActiveIntentIntegrityReport(client)).toEqual(report);

    await client.query('UPDATE pg_temp.policy_intents SET active = FALSE WHERE id NOT IN (9007199254740993, 12, 13)');
    expect(await lifecycle.verifyRestoredDatabase({ dbClient: client })).toMatchObject({
      verified: true,
      nativeAuthorityIntegrity: true,
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
});
