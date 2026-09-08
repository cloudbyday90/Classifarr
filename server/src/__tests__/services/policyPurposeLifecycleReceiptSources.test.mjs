/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyPurposeLifecycleReceiptSourceCtesSql,
} from '../../services/policyPurposeLifecycleReceiptSources.mjs';

describe('policyPurposeLifecycleReceiptSources', () => {
  test('builds active-policy lifecycle sources only from fixed durable receipt bindings', () => {
    const sql = buildPolicyPurposeLifecycleReceiptSourceCtesSql({
      scope: 'active-policy-inventory',
    });

    expect(sql).toContain('initial_lifecycle_receipts AS')
    expect(sql).toContain('change_lifecycle_receipts AS')
    expect(sql).toContain('library_rebuild_replacement_lifecycle_receipts AS')
    expect(sql).toContain('policy_library_rebuild_execution_gates')
    expect(sql).toContain('policy_migration_verification_runs')
    expect(sql).toContain("execution.state = 'replacement_applied'")
    expect(sql).toContain("replacement_event.event_type = 'library_rebuild_replacement_applied'")
    expect(sql).toContain("verification_run.verifier_status_id = 'no_migration_differences'")
    expect(sql).toContain('verification_run.verifier_difference_count = 0')
    expect(sql).toContain('active_native_policies active')
    expect(sql).not.toContain('LIMIT $1')
    expect(sql).not.toContain('rule.values')
    expect(sql).not.toContain('actor_id')
    expect(sql).not.toContain('metadata')
    expect(sql).not.toContain('library.name')
    expect(sql).not.toContain('policy.name')
  })

  test('uses one bounded parameter for each recent receipt source', () => {
    const sql = buildPolicyPurposeLifecycleReceiptSourceCtesSql({
      scope: 'recent-receipt-window',
    });

    expect(sql.match(/LIMIT \$1/g)).toHaveLength(3)
    expect(sql).not.toContain('active_native_policies active')
  })

  test('rejects a caller-selected SQL scope', () => {
    expect(() => buildPolicyPurposeLifecycleReceiptSourceCtesSql({
      scope: 'untrusted',
    })).toThrow('known fixed query scope')
  })
})
