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
    expect(sql).not.toMatch(/SELECT\s+[^;]*rule\.values\s+AS/isu)
    expect(sql).not.toContain('classification_history')
    expect(sql).not.toContain('rag_')
    expect(values).toEqual([51])
  });
});
