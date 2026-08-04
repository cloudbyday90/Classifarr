/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  loadPendingQuestionCleanupContextState,
  loadPendingQuestionCleanupInventoryRows,
} from './policyRuntimePendingQuestionCleanupInventoryRepository.mjs';
import {
  buildPolicyRuntimePendingQuestionCleanupInventoryReport,
  collectPendingQuestionCleanupInventoryReferences,
} from './policyRuntimePendingQuestionCleanupInventoryReport.mjs';

export class PolicyRuntimePendingQuestionCleanupInventoryService {
  constructor({ db, now = null } = {}) {
    if (!db || typeof db.withTransaction !== 'function') {
      throw new TypeError('Pending-question cleanup inventory requires a transaction-capable database.');
    }

    this.db = db;
    this.now = now;
  }

  async run() {
    return this.db.withTransaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const inventory = await loadPendingQuestionCleanupInventoryRows(client);
      const references = collectPendingQuestionCleanupInventoryReferences(inventory.rows);
      const contextState = await loadPendingQuestionCleanupContextState(client, references);

      return buildPolicyRuntimePendingQuestionCleanupInventoryReport({
        rows: inventory.rows,
        totalPendingCount: inventory.totalPendingCount,
        maxRecords: inventory.maxRecords,
        truncated: inventory.truncated,
        contextState,
        now: this.now,
      });
    });
  }
}
