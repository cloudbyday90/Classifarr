/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  isAiVerificationCapabilityChangeReceiptActorId,
} from './aiVerificationCapabilityChangeReceiptActorIdentity.mjs';
import {
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_VERSION,
  isCandidateBoundVerificationCapabilityStatusId,
} from './classificationCandidateBoundVerificationCapabilityChangeReceipt.mjs';

const POSITIVE_INTEGER = /^[1-9][0-9]{0,18}$/;

function assertQueryClient(client, operation) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError(`Verification capability change receipt ${operation} requires a database query client.`);
  }
}

function assertActorId(actorId) {
  if (!isAiVerificationCapabilityChangeReceiptActorId(actorId)) {
    throw new TypeError('Verification capability change receipt actor ID is invalid.');
  }
}

function normalizePositiveInteger(value, field) {
  const normalized = String(value ?? '').trim();
  if (!POSITIVE_INTEGER.test(normalized)) {
    throw new TypeError(`Verification capability change receipt ${field} must be a positive integer.`);
  }
  return normalized;
}

function assertReceipt(receipt) {
  assertActorId(receipt?.actorId);
  if (!isCandidateBoundVerificationCapabilityStatusId(receipt?.beforeStatusId)
    || !isCandidateBoundVerificationCapabilityStatusId(receipt?.afterStatusId)
    || receipt.beforeStatusId === receipt.afterStatusId) {
    throw new TypeError('Verification capability change receipt status transition is invalid.');
  }
  normalizePositiveInteger(receipt?.configurationRevision, 'configuration revision');
}

/**
 * Persists and reads the narrow receipt record. Callers own the transaction so
 * a failed insert rolls back the corresponding configuration mutation.
 */
export class ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository {
  /**
   * @param {{
   *   client?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
   *   receipt?: Record<string, unknown>,
   * }} request
   */
  async record(request = {}) {
    const { client, receipt } = request;
    assertQueryClient(client, 'recording');
    assertReceipt(receipt);

    const result = await client.query(
      `INSERT INTO candidate_bound_verification_capability_receipts (
         actor_id,
         before_status_id,
         after_status_id,
         configuration_revision,
         receipt_version
       )
       VALUES ($1, $2, $3, $4::bigint, $5)
       RETURNING id, created_at`,
      [
        receipt.actorId,
        receipt.beforeStatusId,
        receipt.afterStatusId,
        String(receipt.configurationRevision),
        CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_CAPABILITY_CHANGE_RECEIPT_VERSION,
      ],
    );

    return result.rows[0] || null;
  }

  /**
   * @param {{
   *   client?: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
   *   actorId?: unknown,
   *   beforeReceiptId?: unknown,
   *   limit?: unknown,
   * }} request
   */
  async listForActor(request = {}) {
    const {
      client,
      actorId,
      beforeReceiptId = null,
      limit,
    } = request;
    assertQueryClient(client, 'listing');
    assertActorId(actorId);
    const normalizedLimit = Number(normalizePositiveInteger(limit, 'limit'));
    const normalizedBeforeReceiptId = beforeReceiptId === null || beforeReceiptId === undefined
      ? null
      : normalizePositiveInteger(beforeReceiptId, 'cursor');

    const result = await client.query(
      `SELECT
         id,
         before_status_id,
         after_status_id,
         configuration_revision,
         created_at
       FROM candidate_bound_verification_capability_receipts
       WHERE actor_id = $1
         AND ($2::bigint IS NULL OR id < $2::bigint)
       ORDER BY id DESC
       LIMIT $3`,
      [actorId, normalizedBeforeReceiptId, normalizedLimit],
    );

    return result.rows;
  }
}
