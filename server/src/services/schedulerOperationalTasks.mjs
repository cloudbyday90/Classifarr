/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { mediaSyncService } from './mediaSync.mjs';
import { classificationService } from './classification.mjs';
import { enrichmentRetryService } from './enrichmentRetryService.mjs';
import { queueService } from './queueService.mjs';

const logger = createLogger('SchedulerService');

// Human-readable reason stamped on classifications that exhaust their automatic
// retry budget and are dead-lettered to a terminal `failed` state.
const DEAD_LETTER_REASON =
    'AI retry attempts exhausted - resolve the AI issue and use Retry Classification to try again';

export async function runGapAnalysis() {
    try {
        await queueService.refillQueue();
    } catch (error) {
        logger.error('Error running gap analysis', { error: error.message });
    }
}

export async function runPeriodicLibrarySync() {
    try {
        const libraries = await db.query('SELECT id, name FROM libraries WHERE is_active = true');

        if (libraries.rows.length === 0) {
            logger.debug('Periodic sync: No active libraries to sync');
            return;
        }

        logger.info(`Periodic sync: Syncing ${libraries.rows.length} libraries`);

        for (const library of libraries.rows) {
            try {
                await mediaSyncService.syncLibrary(library.id);
                logger.info(`Periodic sync: Completed ${library.name}`);
            } catch (libError) {
                logger.warn(`Periodic sync: Failed ${library.name}`, { error: libError.message });
            }
        }
    } catch (error) {
        logger.error('Error running periodic library sync', { error: error.message });
    }
}

export async function runLibraryWatchdog() {
    try {
        const result = await db.query(`
            SELECT l.id, l.name
            FROM libraries l
            WHERE l.is_active = true
              AND NOT EXISTS (
                  SELECT 1 FROM media_server_items msi WHERE msi.library_id = l.id
              )
              AND NOT EXISTS (
                  SELECT 1 FROM media_server_sync_status ss
                   WHERE ss.library_id = l.id AND ss.status = 'running'
              )
        `);

        for (const library of result.rows) {
            logger.info(`Watchdog: Library ${library.name} (${library.id}) is empty. Triggering auto-sync...`);
            mediaSyncService.syncLibrary(library.id).catch((err) => {
                logger.error(`Watchdog: Auto-sync failed for ${library.name}`, { error: err.message });
            });
        }
    } catch (error) {
        logger.error('Error running library watchdog', { error: error.message });
    }
}

export async function processRetryQueue() {
    try {
        await deadLetterExhaustedRetries();

        const result = await db.query(`
            SELECT id, title, retry_count, max_retries
            FROM classification_history
            WHERE status = 'pending_retry'
              AND retry_after <= NOW()
              AND retry_count < max_retries
            ORDER BY retry_after ASC
            LIMIT 50
        `);

        if (result.rows.length === 0) {
            logger.debug('Retry queue: No items ready for retry');
            return;
        }

        logger.info(`Retry queue: Processing ${result.rows.length} items`);

        for (const item of result.rows) {
            try {
                await classificationService.retryClassification(item.id);
            } catch (itemError) {
                logger.error(`Retry queue: Failed to retry classification ${item.id}`, {
                    error: itemError.message,
                    title: item.title,
                });
            }
        }

        logger.info(`Retry queue: Completed processing ${result.rows.length} items`);
    } catch (error) {
        logger.error('Error processing retry queue', {
            error: error.message,
            stack: error.stack,
        });
    }
}

/**
 * Dead-letter sweep for the classification retry queue.
 *
 * Items that have exhausted their automatic retry budget (`retry_count >=
 * max_retries`) are otherwise never re-selected by `processRetryQueue` and
 * would sit in `pending_retry` indefinitely. Following the dead-letter queue
 * pattern (Azure Service Bus `MaxDeliveryCountExceeded`, AWS retry-with-backoff
 * "fail after N attempts"), we move them to a terminal `failed` state with a
 * clear reason/description, remove them from the active retry loop
 * (`retry_after = NULL`), and leave them visible in History. They remain
 * recoverable via the manual Retry Classification action, which intentionally
 * ignores the `max_retries` cap once the underlying issue is resolved.
 */
export async function deadLetterExhaustedRetries() {
    try {
        const result = await db.query(`
            UPDATE classification_history
            SET status = 'failed',
                retry_after = NULL,
                reason = $1,
                pending_reason = $1,
                error_message = COALESCE(
                    error_message,
                    'Automatic classification retries exhausted after '
                        || retry_count || ' of ' || max_retries || ' attempts'
                )
            WHERE status = 'pending_retry'
              AND retry_count >= max_retries
            RETURNING id, title, retry_count, max_retries
        `, [DEAD_LETTER_REASON]);

        if (result.rows.length === 0) {
            return { deadLettered: 0 };
        }

        logger.warn(`Retry queue: Dead-lettered ${result.rows.length} exhausted classifications`, {
            reasonCode: 'retry_exhausted',
            ids: result.rows.map((row) => row.id),
        });

        return { deadLettered: result.rows.length };
    } catch (error) {
        logger.error('Error dead-lettering exhausted classification retries', {
            error: error.message,
            stack: error.stack,
        });
        return { deadLettered: 0, error: error.message };
    }
}

export async function processEnrichmentRetryQueue() {
    try {
        await enrichmentRetryService.triggerProcessing();
    } catch (error) {
        logger.error('Error in enrichment retry queue processing', {
            error: error.message,
            stack: error.stack,
        });
    }
}
