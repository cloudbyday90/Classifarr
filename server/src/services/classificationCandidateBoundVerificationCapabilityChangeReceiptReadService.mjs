/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ValidationError } from '../utils/appError.mjs';
import {
  isAiVerificationCapabilityChangeReceiptActorId,
} from './aiVerificationCapabilityChangeReceiptActorIdentity.mjs';
import {
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_VERSION,
  getCandidateBoundVerificationCapabilityReceiptStatus,
} from './classificationCandidateBoundVerificationCapabilityChangeReceipt.mjs';

export const CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_DEFAULT_LIMIT = 5;
export const CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_MAX_LIMIT = 20;

const POSITIVE_INTEGER = /^[1-9][0-9]{0,18}$/;
const ALLOWED_QUERY_KEYS = new Set(['limit', 'before']);

function normalizePositiveInteger(value, field, { defaultValue = null, max = null } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim();
  if (!POSITIVE_INTEGER.test(normalized)) {
    throw new ValidationError(`Verification capability receipt ${field} must be a positive integer.`, {
      code: 'invalid_verification_capability_receipt_query',
    });
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || (max !== null && parsed > max)) {
    throw new ValidationError(`Verification capability receipt ${field} is outside the supported range.`, {
      code: 'invalid_verification_capability_receipt_query',
    });
  }
  return normalized;
}

/**
 * @param {Record<string, unknown>} query
 */
export function normalizeCandidateBoundVerificationCapabilityChangeReceiptQuery(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new ValidationError('Verification capability receipt query is invalid.', {
      code: 'invalid_verification_capability_receipt_query',
    });
  }

  const unknownKeys = Object.keys(query).filter(key => !ALLOWED_QUERY_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new ValidationError('Unsupported verification capability receipt query parameters.', {
      code: 'invalid_verification_capability_receipt_query',
    });
  }

  return Object.freeze({
    limit: Number(normalizePositiveInteger(query.limit, 'limit', {
      defaultValue: String(CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_DEFAULT_LIMIT),
      max: CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_MAX_LIMIT,
    })),
    beforeReceiptId: normalizePositiveInteger(query.before, 'cursor'),
  });
}

function asIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Verification capability receipt timestamp is invalid.');
  }
  return date.toISOString();
}

function buildReceiptProjection(receipt) {
  const receiptId = String(receipt?.id ?? '');
  const configurationRevision = String(receipt?.configuration_revision ?? '');
  if (!POSITIVE_INTEGER.test(receiptId) || !POSITIVE_INTEGER.test(configurationRevision)) {
    throw new Error('Verification capability receipt record is invalid.');
  }

  return Object.freeze({
    receiptId,
    before: getCandidateBoundVerificationCapabilityReceiptStatus(receipt.before_status_id),
    after: getCandidateBoundVerificationCapabilityReceiptStatus(receipt.after_status_id),
    configurationRevision,
    recordedAt: asIsoTimestamp(receipt.created_at),
  });
}

/**
 * Reads receipts only for the authenticated actor. The browser cannot choose
 * an actor and never receives configuration or provider data.
 */
export class ClassificationCandidateBoundVerificationCapabilityChangeReceiptReadService {
  /**
   * @param {{
   *   db?: { withTransaction: (callback: (client: { query: Function }) => Promise<Record<string, unknown>>) => Promise<Record<string, unknown>> },
   *   receiptRepository?: { listForActor: (request: Record<string, unknown>) => Promise<Record<string, unknown>[]> },
   * }} options
   */
  constructor(options = {}) {
    const { db, receiptRepository } = options;
    if (!db || typeof db.withTransaction !== 'function') {
      throw new TypeError('Verification capability receipt read service requires a transaction-capable database.');
    }
    if (typeof receiptRepository?.listForActor !== 'function') {
      throw new TypeError('Verification capability receipt read service requires a receipt repository.');
    }

    this.db = db;
    this.receiptRepository = receiptRepository;
  }

  /**
   * @param {{ actorId?: unknown, query?: Record<string, unknown> }} request
   */
  async list(request = {}) {
    const { actorId, query } = request;
    if (!isAiVerificationCapabilityChangeReceiptActorId(actorId)) {
      throw new ValidationError('Verification capability receipt actor identity is invalid.', {
        code: 'verification_capability_receipt_actor_identity_required',
      });
    }
    const { limit, beforeReceiptId } = normalizeCandidateBoundVerificationCapabilityChangeReceiptQuery(query || {});

    return this.db.withTransaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const rows = await this.receiptRepository.listForActor({
        client,
        actorId,
        beforeReceiptId,
        limit: limit + 1,
      });
      const hasMore = rows.length > limit;
      const visibleRows = rows.slice(0, limit);
      const receipts = visibleRows.map(buildReceiptProjection);

      return /** @type {Record<string, unknown>} */ (Object.freeze({
        version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_VERSION,
        mode: 'read_only',
        receipts,
        nextBefore: hasMore && receipts.length > 0 ? receipts.at(-1).receiptId : null,
        sideEffects: Object.freeze({
          providerCalled: false,
          configurationPersisted: false,
          routingChanged: false,
          policyChanged: false,
          retryQueued: false,
        }),
      }));
    });
  }
}
