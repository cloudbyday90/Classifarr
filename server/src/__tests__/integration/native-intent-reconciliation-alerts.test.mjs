/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from './setup.mjs';

let db;

function buildFailureStatus() {
  return {
    statusId: 'attention_required',
    control: { automationEnabled: true, circuitState: 'closed' },
    inventory: { unresolvedCount: 0, oldestUnresolvedAt: null },
    recentFailedRunCount: 3,
  };
}

function buildHealthyStatus() {
  return {
    ...buildFailureStatus(),
    statusId: 'ready',
    recentFailedRunCount: 0,
  };
}

beforeAll(() => {
  db = getPool();
});

beforeEach(async () => {
  await db.query('DELETE FROM policy_native_intent_reconciliation_alert_states');
  await db.query(
    `DELETE FROM app_notifications
     WHERE data ->> 'notificationType' = 'native_intent_reconciliation_alert'`,
  );
});

describe('Native intent reconciliation alert integration', () => {
  test('persists and deduplicates repeated-failure alerts with the real PostgreSQL upsert', async () => {
    const { NativeIntentReconciliationAlertService } =
      await import('../../services/nativeIntentReconciliationAlertService.mjs');
    let now = new Date('2026-07-16T14:00:00.000Z');
    let status = buildFailureStatus();
    const service = new NativeIntentReconciliationAlertService({
      statusService: { getStatus: async () => status },
      now: () => now,
      loggerInstance: { info: () => undefined },
    });

    const first = await service.evaluateAndNotify({
      correlationId: 'a1a6e131-16b6-430b-81bb-29ab2e8db213',
    });
    now = new Date('2026-07-16T14:05:00.000Z');
    const duplicate = await service.evaluateAndNotify({
      correlationId: 'a1a6e131-16b6-430b-81bb-29ab2e8db213',
    });
    status = buildHealthyStatus();
    now = new Date('2026-07-16T14:10:00.000Z');
    const resolved = await service.evaluateAndNotify({
      correlationId: 'a1a6e131-16b6-430b-81bb-29ab2e8db213',
    });

    expect(first).toMatchObject({
      statusId: 'evaluated',
      notificationCount: 1,
      firingAlertTypeIds: ['repeated_system_failure'],
    });
    expect(duplicate).toMatchObject({
      statusId: 'evaluated',
      notificationCount: 0,
      firingAlertTypeIds: ['repeated_system_failure'],
    });
    expect(resolved).toMatchObject({
      statusId: 'evaluated',
      notificationCount: 0,
      firingAlertTypeIds: [],
    });

    const [notifications, states] = await Promise.all([
      db.query(
        `SELECT type, data->>'alertTypeId' AS alert_type_id
         FROM app_notifications
         WHERE data ->> 'notificationType' = 'native_intent_reconciliation_alert'`,
      ),
      db.query(
        `SELECT alert_type_id, alert_state, occurrence_count, last_notified_at, last_resolved_at
         FROM policy_native_intent_reconciliation_alert_states
         WHERE alert_type_id = 'repeated_system_failure'`,
      ),
    ]);

    expect(notifications.rows).toEqual([{
      type: 'error',
      alert_type_id: 'repeated_system_failure',
    }]);
    expect(states.rows).toEqual([expect.objectContaining({
      alert_type_id: 'repeated_system_failure',
      alert_state: 'resolved',
      occurrence_count: 2,
      last_notified_at: expect.any(Date),
      last_resolved_at: expect.any(Date),
    })]);
  });
});
