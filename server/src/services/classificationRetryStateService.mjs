/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import * as classificationRetryPayloadsModule from '../utils/classificationRetryPayloads.mjs';
import * as metadataEnrichmentModule from '../utils/metadataEnrichment.mjs';

class ClassificationRetryStateService {
  constructor(deps = {}) {
    this.classificationRetryPayloads = deps.classificationRetryPayloads || classificationRetryPayloadsModule;
    this.metadataEnrichment = deps.metadataEnrichment || metadataEnrichmentModule;
  }

  async hasPendingClassificationTask(client, identity) {
    if (identity.tmdbId) {
      const result = await client.query(
        `SELECT id, status
         FROM task_queue
         WHERE task_type = 'classification'
           AND status IN ('pending', 'processing')
           AND COALESCE(payload->'media'->>'media_type', payload->>'media_type', 'movie') = $2
           AND (
             ((payload->'media'->>'tmdbId') ~ '^[0-9]+$' AND (payload->'media'->>'tmdbId')::int = $1)
             OR ((payload->>'tmdb_id') ~ '^[0-9]+$' AND (payload->>'tmdb_id')::int = $1)
           )
         ORDER BY created_at ASC
         LIMIT 1`,
        [identity.tmdbId, identity.mediaType]
      );
      if (result.rows[0]) {
        return result.rows[0];
      }
    }

    if (!identity.title) return null;

    const result = await client.query(
      `SELECT id, status
       FROM task_queue
       WHERE task_type = 'classification'
         AND status IN ('pending', 'processing')
         AND COALESCE(payload->'media'->>'media_type', payload->>'media_type', 'movie') = $3
         AND LOWER(TRIM(COALESCE(payload->>'title', payload->>'subject', payload->'media'->>'title', ''))) = $1
         AND COALESCE(NULLIF(COALESCE(payload->>'year', payload->'media'->>'year', ''), ''), '') = COALESCE($2, '')
       ORDER BY created_at ASC
       LIMIT 1`,
      [identity.title, identity.year, identity.mediaType]
    );

    return result.rows[0] || null;
  }

  async resolveMediaItemId(client, metadata, identity) {
    const { toPositiveInt } = this.classificationRetryPayloads;
    const fromMetadata = toPositiveInt(metadata.itemId || metadata.item_id || metadata.media_item_id);
    if (fromMetadata) return fromMetadata;
    const sourceLibraryId = toPositiveInt(metadata.source_library_id);

    if (identity.tmdbId) {
      const byTmdb = sourceLibraryId
        ? await client.query(
          `SELECT id
           FROM media_server_items
           WHERE tmdb_id = $1
             AND media_type = $2
             AND library_id = $3
           ORDER BY last_synced DESC NULLS LAST, id DESC
           LIMIT 1`,
          [identity.tmdbId, identity.mediaType, sourceLibraryId]
        )
        : await client.query(
          `SELECT id
           FROM media_server_items
           WHERE tmdb_id = $1
             AND media_type = $2
           ORDER BY last_synced DESC NULLS LAST, id DESC
           LIMIT 1`,
          [identity.tmdbId, identity.mediaType]
        );
      if (byTmdb.rows[0]?.id) return byTmdb.rows[0].id;
    }

    if (!identity.title) return null;

    const byTitle = sourceLibraryId
      ? await client.query(
        `SELECT id
         FROM media_server_items
         WHERE LOWER(TRIM(title)) = $1
           AND media_type = $2
           AND COALESCE(NULLIF(year::text, ''), '') = COALESCE($3, '')
           AND library_id = $4
         ORDER BY last_synced DESC NULLS LAST, id DESC
         LIMIT 1`,
        [identity.title, identity.mediaType, identity.year, sourceLibraryId]
      )
      : await client.query(
        `SELECT id
         FROM media_server_items
         WHERE LOWER(TRIM(title)) = $1
           AND media_type = $2
           AND COALESCE(NULLIF(year::text, ''), '') = COALESCE($3, '')
         ORDER BY last_synced DESC NULLS LAST, id DESC
         LIMIT 1`,
        [identity.title, identity.mediaType, identity.year]
      );
    return byTitle.rows[0]?.id || null;
  }

  async cleanupClassificationArtifacts(client, classificationId) {
    await client.query('UPDATE media_requests SET classification_id = NULL WHERE classification_id = $1', [classificationId]);
    await client.query('UPDATE webhook_log SET classification_id = NULL WHERE classification_id = $1', [classificationId]);
    await client.query(
      `DELETE FROM app_notifications
       WHERE data IS NOT NULL
         AND (
           (data ? 'classificationId' AND (data->>'classificationId') ~ '^[0-9]+$' AND (data->>'classificationId')::int = $1)
           OR (data ? 'classification_id' AND (data->>'classification_id') ~ '^[0-9]+$' AND (data->>'classification_id')::int = $1)
         )`,
      [classificationId]
    );
    await client.query('DELETE FROM clarification_responses WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM content_analysis_log WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM classification_corrections WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM classification_embeddings WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM embedding_errors WHERE classification_id = $1', [classificationId]);
    await client.query('DELETE FROM pattern_match_log WHERE classification_id = $1', [classificationId]);
  }

  async captureRetryLineage(client, classificationId) {
    const { toPositiveInt } = this.classificationRetryPayloads;
    const mediaRequestsResult = await client.query(
      `SELECT id
       FROM media_requests
       WHERE classification_id = $1
       ORDER BY id ASC`,
      [classificationId]
    );

    const webhookLogResult = await client.query(
      `SELECT id
       FROM webhook_log
       WHERE classification_id = $1
       ORDER BY id ASC`,
      [classificationId]
    );

    const mediaRequestIds = mediaRequestsResult.rows
      .map((row) => toPositiveInt(row.id))
      .filter(Boolean);
    const webhookLogIds = webhookLogResult.rows
      .map((row) => toPositiveInt(row.id))
      .filter(Boolean);

    if (mediaRequestIds.length === 0 && webhookLogIds.length === 0) {
      return null;
    }

    return {
      original_classification_id: classificationId,
      media_request_ids: mediaRequestIds,
      webhook_log_ids: webhookLogIds
    };
  }

  async cleanupEnrichmentState(client, mediaItemId) {
    const { ENRICHMENT_METADATA_KEYS, buildJsonbDeleteChain } = this.metadataEnrichment;
    if (!mediaItemId) {
      return {
        enrichmentQueueRowsRemoved: 0,
        metadataEnrichmentTasksRemoved: 0,
        enrichmentMetadataReset: false,
        enrichmentCleanupSkipped: 'no_media_item_link',
      };
    }

    const retryQueueResult = await client.query(
      `DELETE FROM enrichment_retry_queue
       WHERE media_item_id = $1`,
      [mediaItemId]
    );

    const metadataTaskResult = await client.query(
      `DELETE FROM task_queue
       WHERE task_type = 'metadata_enrichment'
         AND status IN ('pending', 'processing')
         AND (
           ((payload->>'itemId') ~ '^[0-9]+$' AND (payload->>'itemId')::int = $1)
           OR ((payload->>'media_item_id') ~ '^[0-9]+$' AND (payload->>'media_item_id')::int = $1)
         )`,
      [mediaItemId]
    );

    const metadataResetResult = await client.query(
      `UPDATE media_server_items
       SET metadata = (
         ${buildJsonbDeleteChain("COALESCE(metadata, '{}'::jsonb)", ENRICHMENT_METADATA_KEYS)}
       ),
            enrichment_status = 'pending'
       WHERE id = $1`,
      [mediaItemId]
    );

    return {
      enrichmentQueueRowsRemoved: retryQueueResult.rowCount || 0,
      metadataEnrichmentTasksRemoved: metadataTaskResult.rowCount || 0,
      enrichmentMetadataReset: (metadataResetResult.rowCount || 0) > 0,
      enrichmentCleanupSkipped: null,
    };
  }
}

export { ClassificationRetryStateService };
