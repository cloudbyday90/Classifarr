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
  loadPolicyPurposeLifecycleProvenanceReceiptRecords,
} from '../../services/policyPurposeLifecycleProvenanceReceiptPersistence.mjs';

describe('policyPurposeLifecycleProvenanceReceiptPersistence', () => {
  test('reads only bounded receipt provenance counts and keeps identifiers and rule values in PostgreSQL', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });

    await expect(loadPolicyPurposeLifecycleProvenanceReceiptRecords({
      db: { query },
      limit: 101,
    })).resolves.toEqual([]);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('WITH initial_lifecycle_receipts AS')
    expect(sql).toContain('change_lifecycle_receipts AS')
    expect(sql).toContain('normal_lifecycle_receipts AS')
    expect(sql).toContain('policy_initial_intent_establishments')
    expect(sql).toContain("establishment.state = 'established'")
    expect(sql).toContain('policy_native_intent_change_receipts')
    expect(sql).toContain("change_receipt.result_status_id = 'applied'")
    expect(sql).toContain('LIMIT $1')
    expect(sql).toContain('expected_intent_version')
    expect(sql).toContain("intent.source = 'native_intent'")
    expect(sql).toContain("rule.intent_role = 'purpose'")
    expect(sql).toContain("rule.signal_type IN ('genres', 'keywords', 'studios')")
    expect(sql).toContain('specialized_purpose_rule_count')
    expect(sql).toContain('inferred_profile_purpose_rule_count')
    expect(sql).not.toContain('rule.values')
    expect(sql).not.toContain('actor_id')
    expect(sql).not.toContain('idempotency_key')
    expect(sql).not.toContain('command_fingerprint')
    expect(sql).not.toContain('classification_history')
    expect(sql).not.toContain('rag_')
    expect(values).toEqual([101])
  });
});
