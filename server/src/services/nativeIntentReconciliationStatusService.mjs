/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as defaultDb from '../config/database.mjs';
import {
  nativeIntentReconciliationControlService as defaultControlService,
} from './nativeIntentReconciliationControlService.mjs';
import {
  NATIVE_INTENT_RECONCILIATION_REPEATED_FAILURE_WINDOW_MS,
} from './nativeIntentReconciliationAlertContract.mjs';
import {
  getNextNativeIntentReconciliationAttemptAt,
} from './nativeIntentReconciliationSchedule.mjs';
import {
  buildNativeIntentReconciliationStatus,
  MAX_NATIVE_INTENT_RECONCILIATION_BLOCKER_REASON_GROUPS,
} from './nativeIntentReconciliationStatusContract.mjs';
import {
  loadNativeIntentReconciliationBlockerReasonGroups,
  loadNativeIntentReconciliationLatestRun,
  loadNativeIntentReconciliationRecentFailedRunCount,
  loadNativeIntentReconciliationUnresolvedSummary,
} from './nativeIntentReconciliationStatusPersistence.mjs';

function toIsoTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
}

export class NativeIntentReconciliationStatusService {
  constructor({
    db = defaultDb,
    controlService = defaultControlService,
    now = () => new Date(),
    getNextScheduledAttemptAt = getNextNativeIntentReconciliationAttemptAt,
    loadLatestRun = loadNativeIntentReconciliationLatestRun,
    loadUnresolvedSummary = loadNativeIntentReconciliationUnresolvedSummary,
    loadBlockerReasonGroups = loadNativeIntentReconciliationBlockerReasonGroups,
    loadRecentFailedRunCount = loadNativeIntentReconciliationRecentFailedRunCount,
    buildStatus = buildNativeIntentReconciliationStatus,
  } = {}) {
    this.db = db;
    this.controlService = controlService;
    this.now = now;
    this.getNextScheduledAttemptAt = getNextScheduledAttemptAt;
    this.loadLatestRun = loadLatestRun;
    this.loadUnresolvedSummary = loadUnresolvedSummary;
    this.loadBlockerReasonGroups = loadBlockerReasonGroups;
    this.loadRecentFailedRunCount = loadRecentFailedRunCount;
    this.buildStatus = buildStatus;
  }

  async getStatus({ dbClient = this.db, now = this.now() } = {}) {
    const evaluatedAt = toIsoTimestamp(now);
    const recentFailureSince = new Date(
      new Date(evaluatedAt).getTime() - NATIVE_INTENT_RECONCILIATION_REPEATED_FAILURE_WINDOW_MS,
    ).toISOString();

    const [control, latestRun, inventory, blockerReasonGroups, recentFailedRun] = await Promise.all([
      this.controlService.getStatus({ dbClient }),
      this.loadLatestRun({ db: dbClient }),
      this.loadUnresolvedSummary({ db: dbClient }),
      this.loadBlockerReasonGroups({
        db: dbClient,
        limit: MAX_NATIVE_INTENT_RECONCILIATION_BLOCKER_REASON_GROUPS,
      }),
      this.loadRecentFailedRunCount({ db: dbClient, since: recentFailureSince }),
    ]);

    return this.buildStatus({
      evaluatedAt,
      nextScheduledAttemptAt: this.getNextScheduledAttemptAt(evaluatedAt),
      control,
      latestRun,
      inventory,
      blockerReasonGroups,
      recentFailedRunCount: recentFailedRun?.failed_run_count ?? recentFailedRun?.failedRunCount,
    });
  }
}

export const nativeIntentReconciliationStatusService =
  new NativeIntentReconciliationStatusService();
