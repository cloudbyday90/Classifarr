/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Synchronizes explicit enrichment workflow/provider state onto media items.
 */
import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
    detectEnrichmentProviderState,
    ENRICHMENT_ITEM_STATUSES,
    ENRICHMENT_PROVIDER_STATES,
    TAVILY_MONTHLY_DEFERRED_REASON
} from '../utils/enrichmentState.mjs';

export function deriveEnrichmentItemState(snapshot = {}) {
    const providerState = detectEnrichmentProviderState(snapshot.metadata);
    const hasProcessing = Boolean(snapshot.hasProcessingTask || snapshot.hasProcessingRetry);
    const hasDeferred = Boolean(snapshot.hasDeferredRetry);
    const hasPending = Boolean(snapshot.hasPendingTask || snapshot.hasPendingRetry);
    const hasFailed = Boolean(snapshot.hasFailedTask || snapshot.hasFailedRetry);

    if (hasProcessing) {
        return {
            status: ENRICHMENT_ITEM_STATUSES.PROCESSING,
            providerState,
            deferredReason: null,
        };
    }

    if (hasDeferred) {
        return {
            status: ENRICHMENT_ITEM_STATUSES.DEFERRED,
            providerState,
            deferredReason: snapshot.deferredReason || null,
        };
    }

    if (hasPending) {
        return {
            status: ENRICHMENT_ITEM_STATUSES.PENDING,
            providerState,
            deferredReason: null,
        };
    }

    if (providerState !== ENRICHMENT_PROVIDER_STATES.NONE) {
        return {
            status: ENRICHMENT_ITEM_STATUSES.COMPLETED,
            providerState,
            deferredReason: null,
        };
    }

    if (hasFailed) {
        return {
            status: ENRICHMENT_ITEM_STATUSES.FAILED,
            providerState,
            deferredReason: null,
        };
    }

    return {
        status: ENRICHMENT_ITEM_STATUSES.PENDING,
        providerState,
        deferredReason: null,
    };
}

export class EnrichmentItemStateService {
    constructor(deps = {}) {
        this.db = deps.db || defaultDb;
        this.logger = deps.logger || createLogger('EnrichmentItemStateService');
    }

    async markProcessing(mediaItemId) {
        if (!mediaItemId) {
            return null;
        }

        try {
            const result = await this.db.query(
                `UPDATE media_server_items
                 SET enrichment_status = $2,
                     enrichment_deferred_reason = NULL
                 WHERE id = $1
                 RETURNING id, enrichment_status, enrichment_provider_state, enrichment_deferred_reason`,
                [mediaItemId, ENRICHMENT_ITEM_STATUSES.PROCESSING]
            );

            return result.rows[0] || null;
        } catch (error) {
            this.logger.error('Failed to mark enrichment item as processing', {
                mediaItemId,
                error: error.message
            });
            return null;
        }
    }

    async getSnapshot(mediaItemId) {
        const result = await this.db.query(
            `SELECT
                msi.id,
                msi.metadata,
                EXISTS (
                    SELECT 1
                    FROM task_queue tq
                    WHERE tq.task_type = 'metadata_enrichment'
                      AND tq.status = 'processing'
                      AND (
                        ((tq.payload->>'itemId') ~ '^[0-9]+$' AND (tq.payload->>'itemId')::int = msi.id)
                        OR ((tq.payload->>'media_item_id') ~ '^[0-9]+$' AND (tq.payload->>'media_item_id')::int = msi.id)
                      )
                ) AS has_processing_task,
                EXISTS (
                    SELECT 1
                    FROM task_queue tq
                    WHERE tq.task_type = 'metadata_enrichment'
                      AND tq.status = 'pending'
                      AND (
                        ((tq.payload->>'itemId') ~ '^[0-9]+$' AND (tq.payload->>'itemId')::int = msi.id)
                        OR ((tq.payload->>'media_item_id') ~ '^[0-9]+$' AND (tq.payload->>'media_item_id')::int = msi.id)
                      )
                ) AS has_pending_task,
                EXISTS (
                    SELECT 1
                    FROM task_queue tq
                    WHERE tq.task_type = 'metadata_enrichment'
                      AND tq.status = 'failed'
                      AND (
                        ((tq.payload->>'itemId') ~ '^[0-9]+$' AND (tq.payload->>'itemId')::int = msi.id)
                        OR ((tq.payload->>'media_item_id') ~ '^[0-9]+$' AND (tq.payload->>'media_item_id')::int = msi.id)
                      )
                ) AS has_failed_task,
                EXISTS (
                    SELECT 1
                    FROM enrichment_retry_queue erq
                    WHERE erq.media_item_id = msi.id
                      AND erq.status = 'processing'
                ) AS has_processing_retry,
                EXISTS (
                    SELECT 1
                    FROM enrichment_retry_queue erq
                    WHERE erq.media_item_id = msi.id
                      AND erq.status = 'pending'
                      AND erq.reason IS DISTINCT FROM $2
                ) AS has_pending_retry,
                EXISTS (
                    SELECT 1
                    FROM enrichment_retry_queue erq
                    WHERE erq.media_item_id = msi.id
                      AND erq.status = 'pending'
                      AND erq.reason = $2
                ) AS has_deferred_retry,
                EXISTS (
                    SELECT 1
                    FROM enrichment_retry_queue erq
                    WHERE erq.media_item_id = msi.id
                      AND erq.status = 'failed'
                ) AS has_failed_retry,
                (
                    SELECT erq.reason
                    FROM enrichment_retry_queue erq
                    WHERE erq.media_item_id = msi.id
                      AND erq.status = 'pending'
                      AND erq.reason = $2
                    ORDER BY erq.created_at ASC
                    LIMIT 1
                ) AS deferred_reason
             FROM media_server_items msi
             WHERE msi.id = $1`,
            [mediaItemId, TAVILY_MONTHLY_DEFERRED_REASON]
        );

        return result.rows[0] || null;
    }

    async syncItemState(mediaItemId) {
        if (!mediaItemId) {
            return null;
        }

        try {
            const snapshot = await this.getSnapshot(mediaItemId);
            if (!snapshot) {
                return null;
            }

            const derived = deriveEnrichmentItemState({
                metadata: snapshot.metadata || {},
                hasProcessingTask: snapshot.has_processing_task,
                hasPendingTask: snapshot.has_pending_task,
                hasFailedTask: snapshot.has_failed_task,
                hasProcessingRetry: snapshot.has_processing_retry,
                hasPendingRetry: snapshot.has_pending_retry,
                hasDeferredRetry: snapshot.has_deferred_retry,
                hasFailedRetry: snapshot.has_failed_retry,
                deferredReason: snapshot.deferred_reason
            });

            const updateResult = await this.db.query(
                `UPDATE media_server_items
                 SET enrichment_status = $2,
                     enrichment_provider_state = $3,
                     enrichment_deferred_reason = $4
                 WHERE id = $1
                 RETURNING id, enrichment_status, enrichment_provider_state, enrichment_deferred_reason`,
                [
                    mediaItemId,
                    derived.status,
                    derived.providerState,
                    derived.deferredReason
                ]
            );

            return updateResult.rows[0] || null;
        } catch (error) {
            this.logger.error('Failed to sync enrichment item state', {
                mediaItemId,
                error: error.message
            });
            return null;
        }
    }

    async syncItemStates(mediaItemIds = []) {
        const uniqueIds = [...new Set(mediaItemIds.filter(Boolean))];
        const results = [];
        for (const mediaItemId of uniqueIds) {
            const row = await this.syncItemState(mediaItemId);
            if (row) {
                results.push(row);
            }
        }
        return results;
    }
}
