/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  buildNativeIntentReconciliationAlertEvaluation,
  NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS,
} from './nativeIntentReconciliationAlertContract.mjs';
import {
  insertNativeIntentReconciliationAlertNotification,
  loadNativeIntentReconciliationAlertStates,
  upsertNativeIntentReconciliationAlertState,
} from './nativeIntentReconciliationAlertPersistence.mjs';
import {
  nativeIntentReconciliationStatusService as defaultStatusService,
} from './nativeIntentReconciliationStatusService.mjs';

const logger = createLogger('NativeIntentReconciliationAlertService');
const CORRELATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
}

function normalizeCorrelationId(value) {
  return typeof value === 'string' && CORRELATION_ID_PATTERN.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

export class NativeIntentReconciliationAlertService {
  constructor({
    db = defaultDb,
    statusService = defaultStatusService,
    now = () => new Date(),
    loadAlertStates = loadNativeIntentReconciliationAlertStates,
    upsertAlertState = upsertNativeIntentReconciliationAlertState,
    insertNotification = insertNativeIntentReconciliationAlertNotification,
    buildEvaluation = buildNativeIntentReconciliationAlertEvaluation,
    loggerInstance = logger,
  } = {}) {
    this.db = db;
    this.statusService = statusService;
    this.now = now;
    this.loadAlertStates = loadAlertStates;
    this.upsertAlertState = upsertAlertState;
    this.insertNotification = insertNotification;
    this.buildEvaluation = buildEvaluation;
    this.logger = loggerInstance;
  }

  async evaluateAndNotify({ dbClient = this.db, correlationId = null } = {}) {
    if (typeof dbClient?.withTransaction !== 'function') {
      throw new TypeError('Native intent reconciliation alerts require a transaction boundary.');
    }

    const evaluatedAt = toIsoTimestamp(this.now());
    const safeCorrelationId = normalizeCorrelationId(correlationId);
    const status = await this.statusService.getStatus({ dbClient, now: evaluatedAt });
    const alertTypeIds = Object.values(NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS);

    const result = await dbClient.withTransaction(async client => {
      const priorAlertStates = await this.loadAlertStates({ client, alertTypeIds });
      const evaluations = this.buildEvaluation({
        status,
        priorAlertStates,
        evaluatedAt,
      });
      const knownAlertTypes = new Set(priorAlertStates.map(state => state.alert_type_id));
      let notificationCount = 0;

      for (const alert of evaluations) {
        if (alert.alertState !== 'firing' && !knownAlertTypes.has(alert.alertTypeId)) continue;

        if (alert.notificationDue) {
          await this.insertNotification({ client, alert });
          notificationCount += 1;
        }
        await this.upsertAlertState({
          client,
          alert,
          evaluatedAt,
          notifiedAt: alert.notificationDue ? evaluatedAt : null,
        });
      }

      return { evaluations, notificationCount };
    });

    const firingAlertTypeIds = result.evaluations
      .filter(alert => alert.alertState === 'firing')
      .map(alert => alert.alertTypeId);
    this.logger.info('Native intent reconciliation alerts evaluated', {
      statusId: status.statusId,
      correlationId: safeCorrelationId,
      firingAlertTypeIds,
      notificationCount: result.notificationCount,
      rawPayloadExposed: false,
    });

    return {
      statusId: 'evaluated',
      notificationCount: result.notificationCount,
      firingAlertTypeIds,
      rawPayloadExposed: false,
    };
  }
}

export const nativeIntentReconciliationAlertService =
  new NativeIntentReconciliationAlertService();
