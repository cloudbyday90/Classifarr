/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  upsertNativeIntentReconciliationAlertState,
} from '../../services/nativeIntentReconciliationAlertPersistence.mjs';

describe('Native intent reconciliation alert persistence', () => {
  test('starts a reopened incident without retaining a prior notification timestamp', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ alert_type_id: 'circuit_open' }] });

    await upsertNativeIntentReconciliationAlertState({
      client: { query },
      alert: { alertTypeId: 'circuit_open', alertState: 'firing' },
      evaluatedAt: '2026-07-16T01:00:00.000Z',
      notifiedAt: null,
    });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("alert_state = 'resolved'");
    expect(sql).toContain('THEN EXCLUDED.last_notified_at');
    expect(values).toEqual([
      'circuit_open',
      'firing',
      '2026-07-16T01:00:00.000Z',
      null,
    ]);
  });
});
