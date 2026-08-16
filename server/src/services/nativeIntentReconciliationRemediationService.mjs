/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as defaultDb from '../config/database.mjs';
import {
  buildNativeIntentReconciliationRemediationInventory,
  normalizeRemediationLimit,
} from './nativeIntentReconciliationRemediationContract.mjs';
import {
  loadNativeIntentReconciliationRemediationRecords,
} from './nativeIntentReconciliationRemediationPersistence.mjs';

export class NativeIntentReconciliationRemediationService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    loadRecords = loadNativeIntentReconciliationRemediationRecords,
    buildInventory = buildNativeIntentReconciliationRemediationInventory,
  } = {}) {
    this.db = db;
    this.now = now;
    this.loadRecords = loadRecords;
    this.buildInventory = buildInventory;
  }

  async getInventory({ dbClient = this.db, limit, now = this.now() } = {}) {
    const records = await this.loadRecords({
      db: dbClient,
      limit: normalizeRemediationLimit(limit),
    });

    return this.buildInventory({ records, evaluatedAt: now });
  }
}

export const nativeIntentReconciliationRemediationService =
  new NativeIntentReconciliationRemediationService();
