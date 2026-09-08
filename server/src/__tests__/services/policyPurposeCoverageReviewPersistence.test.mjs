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
  loadPolicyPurposeCoverageReviewRecords,
} from '../../services/policyPurposeCoverageReviewPersistence.mjs';
import {
  loadPolicyPurposeEvidenceInventoryRecord,
} from '../../services/policyPurposeEvidenceInventoryPersistence.mjs';

describe('policyPurposeCoverageReviewPersistence', () => {
  test('compares active native required content terms and shared “any” alternatives inside PostgreSQL without selecting rule values', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });

    await loadPolicyPurposeCoverageReviewRecords({
      db: { query },
      limit: 51,
    });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('WITH active_native_policies AS')
    expect(sql).toContain("intent.source = 'native_intent'")
    expect(sql).toContain("rule.intent_role = 'purpose'")
    expect(sql).toContain("rule.signal_type IN ('genres', 'keywords', 'studios')")
    expect(sql).toContain("rule.values -> 'require_all'")
    expect(sql).toContain("rule.values -> 'require_any'")
    expect(sql).toContain("'require_any'::TEXT AS operator")
    expect(sql).toContain('other_terms.library_id <> candidate_terms.library_id')
    expect(sql).toContain('shared_require_any_counts AS')
    expect(sql).toContain("candidate_terms.term_operator = 'require_any'")
    expect(sql).toContain('specialized_purpose_provenance_counts AS')
    expect(sql).toContain("rule.source = 'media_server_library_profile'")
    expect(sql).toContain("rule.inference_state = 'inferred'")
    expect(sql).toContain('specialized_purpose_rule_count')
    expect(sql).toContain('inferred_profile_purpose_rule_count')
    expect(sql).toContain('declared_native_purpose_rule_count')
    expect(sql).toContain("rule.source IN ('native_intent', 'operator_declared_intent')")
    expect(sql).not.toMatch(/SELECT\s+[^;]*rule\.values\s+AS/isu)
    expect(sql).not.toContain('classification_history')
    expect(sql).not.toContain('rag_')
    expect(values).toEqual([51])
  });

  test('builds a library-agnostic current-intent evidence inventory without values', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        active_policy_count: 10,
        profile_only_purpose_policy_count: 10,
        retained_purpose_policy_count: 0,
        lifecycle_retained_purpose_policy_count: 0,
        lifecycle_receipt_required_policy_count: 0,
        lifecycle_receipt_review_required_policy_count: 0,
      }],
    });

    await expect(loadPolicyPurposeEvidenceInventoryRecord({ db: { query } }))
      .resolves.toEqual({
        active_policy_count: 10,
        profile_only_purpose_policy_count: 10,
        retained_purpose_policy_count: 0,
        lifecycle_retained_purpose_policy_count: 0,
        lifecycle_receipt_required_policy_count: 0,
        lifecycle_receipt_review_required_policy_count: 0,
      });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('WITH active_native_policies AS')
    expect(sql).toContain("intent.source = 'native_intent'")
    expect(sql).toContain('current_purpose_provenance AS')
    expect(sql).toContain('normal_lifecycle_receipts AS')
    expect(sql).toContain('lifecycle_receipt_provenance AS')
    expect(sql).toContain('lifecycle_source_state AS')
    expect(sql).toContain('evidence_policy_state AS')
    expect(sql).toContain('policy_initial_intent_establishments')
    expect(sql).toContain("establishment.state = 'established'")
    expect(sql).toContain('policy_native_intent_change_receipts')
    expect(sql).toContain("change_receipt.result_status_id = 'applied'")
    expect(sql).toContain('policy_library_rebuild_execution_gates')
    expect(sql).toContain('policy_migration_verification_runs')
    expect(sql).toContain("replacement_event.event_type = 'library_rebuild_replacement_applied'")
    expect(sql).toContain("verification_run.verifier_status_id = 'no_migration_differences'")
    expect(sql).toContain('verification_run.verifier_difference_count = 0')
    expect(sql).toContain('active_policy_count')
    expect(sql).toContain('profile_only_purpose_policy_count')
    expect(sql).toContain('retained_purpose_policy_count')
    expect(sql).toContain('lifecycle_retained_purpose_policy_count')
    expect(sql).toContain('lifecycle_receipt_required_policy_count')
    expect(sql).toContain('lifecycle_receipt_review_required_policy_count')
    expect(sql).toContain('current_intent_lifecycle_receipt_count')
    expect(sql).toContain('current_intent_lifecycle_receipt_policy_count')
    expect(sql).toContain('complete_policy_evidence_count')
    expect(sql).toContain("rule.source = 'media_server_library_profile'")
    expect(sql).toContain("rule.inference_state = 'inferred'")
    expect(sql).toContain("rule.source IN ('native_intent', 'operator_declared_intent')")
    expect(sql).not.toContain('rule.values')
    expect(sql).not.toContain('actor_id')
    expect(sql).not.toContain('idempotency_key')
    expect(sql).not.toContain('command_fingerprint')
    expect(sql).not.toContain('library.name')
    expect(sql).not.toContain('policy.name')
    expect(sql).not.toContain('classification_history')
    expect(sql).not.toContain('rag_')
    expect(values).toBeUndefined()
  });
});
