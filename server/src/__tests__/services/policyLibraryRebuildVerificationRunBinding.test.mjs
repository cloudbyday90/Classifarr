import { jest } from '@jest/globals';

import {
  POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS,
  loadPolicyLibraryRebuildExecutionVerificationRunBinding,
  loadPolicyLibraryRebuildVerificationRunBinding,
  validatePolicyLibraryRebuildVerificationRunBinding,
} from '../../services/policyLibraryRebuildVerificationRunBinding.mjs';

const FINGERPRINT = 'a'.repeat(64);

function transition() {
  return {
    policyContext: {
      policyId: 44,
      intentId: 101,
      libraryId: 6,
    },
    transitionFingerprint: {
      fingerprint: FINGERPRINT,
    },
    acceptance: {
      acceptedAt: '2026-07-29T12:00:00.000Z',
    },
  };
}

function proposal() {
  return {
    library: {
      mediaType: 'movie',
    },
  };
}

function verificationRun(overrides = {}) {
  return {
    id: 701,
    run_version: 1,
    policy_id: 44,
    intent_id: 101,
    library_id: 6,
    acceptance_transition_fingerprint: FINGERPRINT,
    source_id: 'persisted_destination_library_final_outcomes',
    source_media_type: 'movie',
    source_deterministic_order_id: 'created_at_desc_id_desc',
    source_maximum_classifications: 5,
    source_rows_read: 5,
    source_rows_considered: 5,
    source_representative_classification_count: 5,
    source_unusable_source_row_count: 0,
    source_coverage_sufficient: true,
    source_audit_ok: true,
    source_audit_issue_count: 0,
    verifier_status_id: 'no_migration_differences',
    verifier_fingerprint: 'b'.repeat(64),
    verifier_difference_count: 0,
    verifier_emitted_difference_count: 0,
    verifier_differences_truncated: false,
    verifier_audit_ok: true,
    verifier_audit_issue_count: 0,
    coordinator_audit_ok: true,
    coordinator_audit_issue_count: 0,
    evaluated_at: '2026-07-29T12:01:00.000Z',
    created_at: '2026-07-29T12:01:00.000Z',
    ...overrides,
  };
}

function execution(overrides = {}) {
  return {
    verification_run_id: 701,
    verification_run_fingerprint: 'b'.repeat(64),
    ...overrides,
  };
}

describe('policyLibraryRebuildVerificationRunBinding', () => {
  test('accepts one matching audited no-difference receipt and projects only its binding', () => {
    const result = validatePolicyLibraryRebuildVerificationRunBinding({
      verificationRun: verificationRun(),
      transition: transition(),
      proposal: proposal(),
    });

    expect(result).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
      verificationRun: {
        id: 701,
        verifierFingerprint: 'b'.repeat(64),
        verifierStatusId: 'no_migration_differences',
      },
    });
  });

  test.each([
    ['missing', null, POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_MISSING],
    ['mismatched', verificationRun({ acceptance_transition_fingerprint: 'c'.repeat(64) }), POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_CONTEXT_MISMATCH],
    ['stale', verificationRun({ evaluated_at: '2026-07-29T11:59:59.000Z' }), POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_STALE],
    ['review-required', verificationRun({ verifier_status_id: 'review_required', verifier_difference_count: 1, verifier_emitted_difference_count: 1 }), POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_REVIEW_REQUIRED],
    ['risk-blocked', verificationRun({ verifier_status_id: 'blocked_by_migration_risk', verifier_difference_count: 1, verifier_emitted_difference_count: 1 }), POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_RISK_BLOCKED],
  ])('rejects %s verification evidence', (_name, evidence, riskId) => {
    const result = validatePolicyLibraryRebuildVerificationRunBinding({
      verificationRun: evidence,
      transition: transition(),
      proposal: proposal(),
    });

    expect(result.ok).toBe(false);
    expect(result.verificationRun).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId }),
    ]));
  });

  test('locks the latest contextual receipt in the caller transaction before validating it', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [verificationRun()] }),
    };

    const result = await loadPolicyLibraryRebuildVerificationRunBinding({
      client,
      transition: transition(),
      proposal: proposal(),
    });

    expect(result.ok).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR KEY SHARE'),
      [44, 101, 6],
    );
  });

  test('locks and validates the exact receipt recorded by the execution gate', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [verificationRun()] }),
    };

    const result = await loadPolicyLibraryRebuildExecutionVerificationRunBinding({
      client,
      execution: execution(),
      transition: transition(),
      proposal: proposal(),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      verificationRun: {
        id: 701,
        verifierFingerprint: 'b'.repeat(64),
        verifierStatusId: 'no_migration_differences',
      },
    }));
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [701],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR KEY SHARE'),
      [701],
    );
  });

  test.each([
    [
      'missing execution receipt binding',
      execution({ verification_run_id: null, verification_run_fingerprint: null }),
      verificationRun(),
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_EXECUTION_BINDING_MISSING,
    ],
    [
      'mismatched execution receipt fingerprint',
      execution({ verification_run_fingerprint: 'c'.repeat(64) }),
      verificationRun(),
      POLICY_LIBRARY_REBUILD_VERIFICATION_BINDING_RISK_IDS.VERIFICATION_RUN_EXECUTION_BINDING_MISMATCH,
    ],
  ])('rejects %s without projecting verification authority', async (
    _name,
    persistedExecution,
    persistedVerificationRun,
    riskId,
  ) => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [persistedVerificationRun] }),
    };

    const result = await loadPolicyLibraryRebuildExecutionVerificationRunBinding({
      client,
      execution: persistedExecution,
      transition: transition(),
      proposal: proposal(),
    });

    expect(result.ok).toBe(false);
    expect(result.verificationRun).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId }),
    ]));
  });
});
