/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  loadNativeIntentReconciliationRemediationRecords,
} from '../../services/nativeIntentReconciliationRemediationPersistence.mjs';

describe('Native intent reconciliation remediation persistence', () => {
  test('uses the reconciliation definition of legacy configuration and authoritative intent', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });

    await loadNativeIntentReconciliationRemediationRecords({
      db: { query },
      limit: 50,
    });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('FROM policy_presets preset');
    expect(sql).toContain('FROM policy_overrides policy_override');
    expect(sql).toContain("intent.source = 'native_intent'");
    expect(sql).toContain("authority_purpose_rule.intent_role = 'purpose'");
    expect(values).toEqual([50]);
  });
});
