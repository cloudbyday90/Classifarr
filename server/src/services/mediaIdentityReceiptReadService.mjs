/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ForbiddenError, ServiceUnavailableError } from '../utils/appError.mjs';
import { reviewInteger, reviewPreviewId } from './mediaIdentityReviewContract.mjs';

function projectReceipt(row, itemId, previewId) {
  const data = row.metadata;
  const validInteger = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
  const date = row.created_at instanceof Date || typeof row.created_at === 'string' ? new Date(row.created_at) : null;
  if (!data || Array.isArray(data) || data.version !== 1 || data.reviewId !== previewId ||
      !validInteger(row.id) || !validInteger(data.itemId) || !validInteger(data.tmdbId) ||
      !['movie', 'tv'].includes(data.mediaType) || typeof data.sourceVersion !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.sourceVersion) || !date || Number.isNaN(date.getTime())) {
    throw new ServiceUnavailableError('The confirmation receipt could not be verified.', { code: 'review_receipt_invalid' });
  }
  if (data.itemId !== itemId) return null;
  return {
    auditId: row.id, previewId, itemId, tmdbId: data.tmdbId, mediaType: data.mediaType,
    sourceVersion: data.sourceVersion, confirmedAt: date.toISOString(),
  };
}

/** Read only committed historical evidence; absence never proves a failed write. */
export async function getMediaIdentityReceipt(db, actorId, rawItemId, rawPreviewId) {
  const itemId = reviewInteger(rawItemId);
  const previewId = reviewPreviewId(rawPreviewId);
  const { rows } = await db.query(`SELECT receipt.id, receipt.created_at, receipt.metadata
    FROM users actor
    LEFT JOIN LATERAL (
      SELECT id, created_at, metadata FROM audit_log
      WHERE user_id = actor.id AND action = 'media_identity_confirmed'
        AND metadata ->> 'reviewId' = $2
      LIMIT 2
    ) receipt ON true
    WHERE actor.id = $1 AND actor.role = 'admin' AND actor.is_active = true`, [reviewInteger(actorId), previewId]);
  if (!rows.length) throw new ForbiddenError('An active administrator account is required', { code: 'review_admin_required' });
  if (rows.length > 1) throw new ServiceUnavailableError('The confirmation receipt could not be verified.', { code: 'review_receipt_invalid' });
  const receipt = rows[0].id === null ? null : projectReceipt(rows[0], itemId, previewId);
  return { version: 1, status: receipt ? 'confirmed' : 'not_observed', receipt };
}
