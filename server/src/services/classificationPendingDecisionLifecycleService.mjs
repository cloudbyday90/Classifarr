/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as defaultDb from '../config/database.mjs';

export const CLASSIFICATION_PENDING_DECISION_IDENTITY_VERSION =
  'classification.pending_decision_identity.v1';

const ACTIVE_PENDING_STATUSES = Object.freeze([
  'awaiting_decision',
  'pending_retry',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizedMediaType(value) {
  const mediaType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return mediaType === 'movie' || mediaType === 'tv' ? mediaType : null;
}

function normalizedOpaqueIdentifier(value, maximumLength = 240) {
  if (value === null || value === undefined) return null;

  const identifier = String(value)
    .normalize('NFKC')
    .trim();
  if (!identifier || identifier.length > maximumLength || /[\u0000-\u001F\u007F]/.test(identifier)) {
    return null;
  }
  return identifier;
}

function normalizedTitle(value) {
  if (typeof value !== 'string') return null;

  const title = value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
  return title && title.length <= 500 ? title : null;
}

function normalizedYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1870 && year <= 9999 ? year : null;
}

function metadataPositiveInteger(metadata, keys) {
  for (const key of keys) {
    const value = positiveInteger(metadata?.[key]);
    if (value) return value;
  }
  return null;
}

function metadataOpaqueIdentifier(metadata, keys) {
  for (const key of keys) {
    const value = normalizedOpaqueIdentifier(metadata?.[key]);
    if (value) return value;
  }
  return null;
}

/**
 * Returns a key only when the item identity is unambiguous. A title-only
 * collision must remain independently reviewable rather than being merged.
 */
export function buildPendingDecisionIdentity({
  metadata = {},
  tmdbId = null,
  mediaType = null,
  title = null,
  year = null,
} = {}) {
  const source = asObject(metadata);
  const resolvedMediaType = normalizedMediaType(mediaType ?? source.media_type ?? source.mediaType);
  if (!resolvedMediaType) return null;

  const resolvedTmdbId = positiveInteger(tmdbId ?? source.tmdb_id ?? source.tmdbId);
  if (resolvedTmdbId) {
    return {
      version: CLASSIFICATION_PENDING_DECISION_IDENTITY_VERSION,
      key: `tmdb:${resolvedMediaType}:${resolvedTmdbId}`,
      kind: 'tmdb',
    };
  }

  const sourceLibraryId = metadataPositiveInteger(source, [
    'source_library_id',
    'sourceLibraryId',
  ]);
  const mediaItemId = metadataOpaqueIdentifier(source, [
    'media_item_id',
    'mediaItemId',
    'item_id',
    'itemId',
    'server_item_id',
    'serverItemId',
  ]);
  const mediaServerId = metadataOpaqueIdentifier(source, [
    'media_server_id',
    'mediaServerId',
    'server_id',
    'serverId',
  ]);
  const mediaItemScope = mediaServerId || (sourceLibraryId ? `source_library:${sourceLibraryId}` : null);
  if (mediaItemId && mediaItemScope) {
    return {
      version: CLASSIFICATION_PENDING_DECISION_IDENTITY_VERSION,
      key: `media_server_item:${resolvedMediaType}:${mediaItemScope}:${mediaItemId}`,
      kind: 'media_server_item',
    };
  }

  const resolvedTitle = normalizedTitle(title ?? source.title);
  const resolvedYear = normalizedYear(year ?? source.year);
  if (sourceLibraryId && resolvedTitle && resolvedYear) {
    return {
      version: CLASSIFICATION_PENDING_DECISION_IDENTITY_VERSION,
      key: `source_title_year:${resolvedMediaType}:${sourceLibraryId}:${resolvedYear}:${resolvedTitle}`,
      kind: 'source_title_year',
    };
  }

  return null;
}

export function isActivePendingDecisionStatus(status) {
  return ACTIVE_PENDING_STATUSES.includes(status);
}

export class ClassificationPendingDecisionLifecycleService {
  constructor(deps = {}) {
    this.db = deps.db || defaultDb;
  }

  async persist({
    status,
    identity = null,
    insert,
  } = {}) {
    if (!isActivePendingDecisionStatus(status) || !identity?.key || typeof insert !== 'function') {
      return {
        classificationId: await insert(null, []),
        supersededClassificationIds: [],
      };
    }

    // Lightweight unit-test database doubles intentionally expose only query.
    // Production database configuration always supplies withTransaction.
    if (typeof this.db.withTransaction !== 'function') {
      return {
        classificationId: await insert(null, []),
        supersededClassificationIds: [],
      };
    }

    return this.db.withTransaction(async (client) => {
      // The partial unique index is the durable invariant. This lock gives the
      // replacement workflow deterministic ordering before it releases an old
      // decision and creates its successor.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [identity.key]);

      const activeResult = await client.query(
        `SELECT id
         FROM classification_history
         WHERE pending_identity_key = $1
           AND status IN ('awaiting_decision', 'pending_retry')
         ORDER BY created_at DESC, id DESC
         FOR UPDATE`,
        [identity.key],
      );
      const supersededClassificationIds = activeResult.rows
        .map((row) => positiveInteger(row.id))
        .filter(Boolean);

      if (supersededClassificationIds.length > 0) {
        await client.query(
          `UPDATE classification_history
           SET status = 'reclassified',
               clarification_status = 'superseded',
               pending_reason = 'Superseded by a newer decision for the same media item',
               policy_question = NULL
           WHERE id = ANY($1::bigint[])`,
          [supersededClassificationIds],
        );
        await client.query(
          `UPDATE app_notifications
           SET is_read = true,
               read_at = COALESCE(read_at, NOW())
           WHERE is_read = false
             AND data IS NOT NULL
             AND data->>'notificationType' = 'awaiting_decision'
             AND (data->>'classificationId') ~ '^[0-9]+$'
             AND (data->>'classificationId')::bigint = ANY($1::bigint[])`,
          [supersededClassificationIds],
        );
      }

      const classificationId = await insert(client, supersededClassificationIds);

      if (supersededClassificationIds.length > 0) {
        await client.query(
          `UPDATE classification_history
           SET metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{pending_decision_lifecycle}',
             jsonb_build_object(
               'version', $2::text,
               'state', 'superseded',
               'superseded_by_classification_id', $3::bigint,
               'superseded_at', NOW()
             ),
             true
           )
           WHERE id = ANY($1::bigint[])`,
          [
            supersededClassificationIds,
            CLASSIFICATION_PENDING_DECISION_IDENTITY_VERSION,
            classificationId,
          ],
        );
      }

      return { classificationId, supersededClassificationIds };
    });
  }
}

export const classificationPendingDecisionLifecycleService =
  new ClassificationPendingDecisionLifecycleService();
