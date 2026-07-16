/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  NativeIntentReconciliationAlertService,
} from '../../services/nativeIntentReconciliationAlertService.mjs';
import {
  NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD,
  NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS,
} from '../../services/nativeIntentReconciliationAlertFailureAttribution.mjs';

describe('NativeIntentReconciliationAlertService', () => {
  test('writes a bounded alert state and one in-app notification inside one transaction', async () => {
    const client = { query: jest.fn() };
    const db = { withTransaction: jest.fn(async work => work(client)) };
    const statusService = {
      getStatus: jest.fn().mockResolvedValue({ statusId: 'circuit_open' }),
    };
    const loadAlertStates = jest.fn().mockResolvedValue([]);
    const evaluations = [{
      alertTypeId: 'circuit_open',
      alertState: 'firing',
      notificationDue: true,
      reasonId: 'reconciliation_circuit_open',
      notificationType: 'error',
      title: 'Automatic policy reconciliation is paused',
      message: 'safe text',
    }];
    const upsertAlertState = jest.fn().mockResolvedValue({ alert_type_id: 'circuit_open' });
    const insertNotification = jest.fn().mockResolvedValue(undefined);
    const loggerInstance = { info: jest.fn() };
    const service = new NativeIntentReconciliationAlertService({
      db,
      statusService,
      now: () => '2026-07-16T01:00:00.000Z',
      loadAlertStates,
      upsertAlertState,
      insertNotification,
      buildEvaluation: jest.fn().mockReturnValue(evaluations),
      loggerInstance,
    });

    const result = await service.evaluateAndNotify({
      correlationId: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c',
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(insertNotification).toHaveBeenCalledWith({ client, alert: evaluations[0] });
    expect(upsertAlertState).toHaveBeenCalledWith(expect.objectContaining({
      client,
      alert: evaluations[0],
      notifiedAt: '2026-07-16T01:00:00.000Z',
    }));
    expect(result).toEqual({
      statusId: 'evaluated',
      notificationCount: 1,
      firingAlertTypeIds: ['circuit_open'],
      rawPayloadExposed: false,
    });
    expect(loggerInstance.info).toHaveBeenCalledWith(
      'Native intent reconciliation alerts evaluated',
      expect.objectContaining({
        correlationId: 'a9cf9f4a-61e3-4ca7-8fe6-b810efff7c1c',
        rawPayloadExposed: false,
      }),
    );
  });

  test('does not log an untrusted caller-provided correlation value', async () => {
    const client = { query: jest.fn() };
    const loggerInstance = { info: jest.fn() };
    const service = new NativeIntentReconciliationAlertService({
      db: { withTransaction: jest.fn(async work => work(client)) },
      statusService: { getStatus: jest.fn().mockResolvedValue({ statusId: 'ready' }) },
      loadAlertStates: jest.fn().mockResolvedValue([]),
      upsertAlertState: jest.fn(),
      insertNotification: jest.fn(),
      buildEvaluation: jest.fn().mockReturnValue([]),
      loggerInstance,
    });

    await service.evaluateAndNotify({ correlationId: 'untrusted-log-value' });

    expect(loggerInstance.info).toHaveBeenCalledWith(
      'Native intent reconciliation alerts evaluated',
      expect.objectContaining({ correlationId: null, rawPayloadExposed: false }),
    );
  });

  test('persists resolution but does not create a notification for a resolved prior alert', async () => {
    const client = { query: jest.fn() };
    const loadAlertStates = jest.fn().mockResolvedValue([{ alert_type_id: 'circuit_open' }]);
    const upsertAlertState = jest.fn().mockResolvedValue({});
    const insertNotification = jest.fn();
    const service = new NativeIntentReconciliationAlertService({
      db: { withTransaction: jest.fn(async work => work(client)) },
      statusService: { getStatus: jest.fn().mockResolvedValue({ statusId: 'ready' }) },
      loadAlertStates,
      upsertAlertState,
      insertNotification,
      buildEvaluation: jest.fn().mockReturnValue([{
        alertTypeId: 'circuit_open',
        alertState: 'resolved',
        notificationDue: false,
      }]),
      loggerInstance: { info: jest.fn() },
    });

    await service.evaluateAndNotify();

    expect(insertNotification).not.toHaveBeenCalled();
    expect(upsertAlertState).toHaveBeenCalledWith(expect.objectContaining({
      notifiedAt: null,
      alert: expect.objectContaining({ alertState: 'resolved' }),
    }));
  });

  test('attributes alert-state persistence failures without retaining database text', async () => {
    const sourceError = Object.assign(
      new Error('inconsistent types deduced for parameter $2; postgres://secret@example'),
      { code: '42P08' },
    );
    const service = new NativeIntentReconciliationAlertService({
      db: { withTransaction: jest.fn(async work => work({})) },
      statusService: { getStatus: jest.fn().mockResolvedValue({ statusId: 'attention_required' }) },
      loadAlertStates: jest.fn().mockResolvedValue([]),
      insertNotification: jest.fn(),
      upsertAlertState: jest.fn().mockRejectedValue(sourceError),
      buildEvaluation: jest.fn().mockReturnValue([{
        alertTypeId: 'repeated_system_failure',
        alertState: 'firing',
        notificationDue: false,
      }]),
      loggerInstance: { info: jest.fn() },
    });

    await expect(service.evaluateAndNotify()).rejects.toMatchObject({
      code: '42P08',
      [NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_FIELD]:
        NATIVE_INTENT_RECONCILIATION_ALERT_FAILURE_STAGE_IDS.STATE_PERSIST,
    });
  });
});
