/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildNativeIntentReconciliationAlertEvaluation,
  NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS,
} from '../../services/nativeIntentReconciliationAlertContract.mjs';

const NOW = '2026-07-16T01:00:00.000Z';

function evaluate(overrides = {}) {
  return buildNativeIntentReconciliationAlertEvaluation({
    evaluatedAt: NOW,
    status: {
      control: { automationEnabled: true, circuitState: 'closed' },
      inventory: { unresolvedCount: 0, oldestUnresolvedAt: null },
      recentFailedRunCount: 0,
      ...overrides.status,
    },
    priorAlertStates: overrides.priorAlertStates || [],
  });
}

describe('Native intent reconciliation alert contract', () => {
  test('evaluates only the three actionable conditions and makes first alerts due', () => {
    const alerts = evaluate({
      status: {
        control: { automationEnabled: true, circuitState: 'open' },
        inventory: { unresolvedCount: 2, oldestUnresolvedAt: '2026-07-15T00:00:00.000Z' },
        recentFailedRunCount: 3,
      },
    });

    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        alertTypeId: NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.CIRCUIT_OPEN,
        alertState: 'firing',
        notificationDue: true,
      }),
      expect.objectContaining({
        alertTypeId: NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.PROLONGED_UNRESOLVED_INVENTORY,
        alertState: 'firing',
        notificationDue: true,
      }),
      expect.objectContaining({
        alertTypeId: NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.REPEATED_SYSTEM_FAILURE,
        alertState: 'firing',
        notificationDue: true,
      }),
    ]));
  });

  test('suppresses duplicate firing notifications until the persisted incident resolves', () => {
    const alerts = evaluate({
      status: {
        inventory: { unresolvedCount: 1, oldestUnresolvedAt: '2026-07-15T00:00:00.000Z' },
      },
      priorAlertStates: [{
        alert_type_id: NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.PROLONGED_UNRESOLVED_INVENTORY,
        alert_state: 'firing',
        last_notified_at: '2026-07-16T00:30:00.000Z',
      }],
    });
    const prolonged = alerts.find(alert => alert.alertTypeId ===
      NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.PROLONGED_UNRESOLVED_INVENTORY);
    const circuit = alerts.find(alert => alert.alertTypeId ===
      NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.CIRCUIT_OPEN);

    expect(prolonged).toEqual(expect.objectContaining({
      alertState: 'firing',
      notificationDue: false,
    }));
    expect(circuit).toEqual(expect.objectContaining({ alertState: 'resolved', notificationDue: false }));
  });
});
