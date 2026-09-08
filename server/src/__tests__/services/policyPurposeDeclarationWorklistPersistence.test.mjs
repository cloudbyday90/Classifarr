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
  loadPolicyPurposeDeclarationWorklistRecords,
} from '../../services/policyPurposeDeclarationWorklistPersistence.mjs';

describe('policyPurposeDeclarationWorklistPersistence', () => {
  test('keeps raw purpose rules in the bounded server-side reduction query', async () => {
    const rows = [{ policy_id: 17, purpose_rules: [] }];
    const query = jest.fn().mockResolvedValue({ rows });

    await expect(loadPolicyPurposeDeclarationWorklistRecords({
      db: { query },
      limit: 51,
    })).resolves.toEqual(rows);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('WITH active_native_policies AS')
    expect(sql).toContain("intent.source = 'native_intent'")
    expect(sql).toContain('jsonb_agg(')
    expect(sql).toContain("rule.intent_role = 'purpose'")
    expect(sql).toContain("rule.collection = 'purpose'")
    expect(sql).toContain("'source', rule.source")
    expect(sql).toContain("'inference_state', rule.inference_state")
    expect(sql).toContain('ORDER BY active.policy_id ASC')
    expect(sql).toContain('LIMIT $1')
    expect(sql).not.toContain('classification_history')
    expect(sql).not.toContain('rag_')
    expect(values).toEqual([51])
  });
});
