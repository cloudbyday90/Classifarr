/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ValidationError } from '../utils/appError.mjs';
import {
  POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECENT_RECEIPT_DISCOVERY_VERSION,
  isHistoricRouteSafetyRefreshReceiptId,
} from './policyRuntimeHistoricRouteSafetyRefreshReceiptContract.mjs';
import {
  isHistoricRouteSafetyRefreshActorId,
} from './policyRuntimeHistoricRouteSafetyRefreshActorIdentity.mjs';

function buildRecentReceiptDiscoveryReport(receipt) {
  const retryReceipt = receipt?.receipt_id;
  if (retryReceipt !== undefined && !isHistoricRouteSafetyRefreshReceiptId(retryReceipt)) {
    throw new Error('Historic route-safety refresh recent receipt discovery returned an invalid receipt ID.');
  }

  return Object.freeze({
    version: POLICY_RUNTIME_HISTORIC_ROUTE_SAFETY_REFRESH_RECENT_RECEIPT_DISCOVERY_VERSION,
    mode: 'read_only',
    recentReceipt: retryReceipt
      ? Object.freeze({ retryReceipt })
      : null,
    sideEffects: Object.freeze({
      classificationRowsMutated: false,
      retryCommandsExecuted: false,
      routesExecuted: false,
      learningWritten: false,
    }),
  });
}

/**
 * Discovers at most one server-owned receipt reference for the authenticated
 * actor. It deliberately does not list historical receipts or return items.
 */
export class PolicyRuntimeHistoricRouteSafetyRefreshRecentReceiptDiscoveryService {
  constructor({ db, receiptRepository } = {}) {
    if (!db || typeof db.withTransaction !== 'function') {
      throw new TypeError('Historic route-safety recent receipt discovery requires a transaction-capable database.');
    }
    if (typeof receiptRepository?.findMostRecentReceiptForActor !== 'function') {
      throw new TypeError('Historic route-safety recent receipt discovery requires a receipt repository.');
    }

    this.db = db;
    this.receiptRepository = receiptRepository;
  }

  async run({ actorId } = {}) {
    if (!isHistoricRouteSafetyRefreshActorId(actorId)) {
      throw new ValidationError('Historic route-safety refresh receipt actor identity is invalid.');
    }

    return this.db.withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const receipt = await this.receiptRepository.findMostRecentReceiptForActor(client, { actorId });
      return buildRecentReceiptDiscoveryReport(receipt);
    });
  }
}

export { buildRecentReceiptDiscoveryReport };
