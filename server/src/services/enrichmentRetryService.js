/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Enrichment Retry Service - Handles Tavily fallback for OMDb failures
 */

const db = require('../config/database');
const tavilyService = require('./tavily');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EnrichmentRetryService');

class EnrichmentRetryService {
    /**
     * Queue an item for enrichment retry
     * @param {number} mediaItemId - The media_server_items.id
     * @param {string} enrichmentType - 'tavily', 'omdb', 'tmdb'
     * @param {string} reason - Why it needs retry
     * @param {number} priority - 1-10, lower = higher priority
     */
    async queueForRetry(mediaItemId, enrichmentType = 'tavily', reason = 'OMDb not found', priority = 5) {
        try {
            await db.query(`
        INSERT INTO enrichment_retry_queue 
          (media_item_id, enrichment_type, reason, priority)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (media_item_id, enrichment_type) DO UPDATE SET
          status = CASE 
            WHEN enrichment_retry_queue.status = 'completed' THEN 'completed'
            ELSE 'pending'
          END,
          reason = EXCLUDED.reason,
          priority = LEAST(enrichment_retry_queue.priority, EXCLUDED.priority)
      `, [mediaItemId, enrichmentType, reason, priority]);

            logger.debug('Queued item for enrichment retry', { mediaItemId, enrichmentType, reason });
        } catch (error) {
            // Handle race condition: Item deleted while queueing
            if (error.code === '23503') { // foreign_key_violation
                logger.warn('Skipping retry queue for deleted item', { mediaItemId });
                return;
            }
            logger.error('Failed to queue item for retry', { error: error.message, mediaItemId });
        }
    }

    /**
     * Get retry queue statistics
     */
    async getStats() {
        const result = await db.query(`
      SELECT 
        enrichment_type,
        status,
        COUNT(*) as count
      FROM enrichment_retry_queue
      GROUP BY enrichment_type, status
      ORDER BY enrichment_type, status
    `);

        const stats = {
            tavily: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 },
            omdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 },
            tmdb: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 },
            total: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 }
        };

        for (const row of result.rows) {
            const type = row.enrichment_type || 'tavily';
            const status = row.status || 'pending';
            const count = parseInt(row.count) || 0;

            if (stats[type]) {
                stats[type][status] = count;
            }
            stats.total[status] = (stats.total[status] || 0) + count;
        }

        return stats;
    }

    /**
     * Process pending items in the retry queue
     * @param {number} limit - Max items to process
     * @param {string} enrichmentType - Type to process ('tavily', 'omdb', etc.)
     */
    async processRetryQueue(limit = 50, enrichmentType = 'tavily') {
        // Check if Tavily is configured
        const tavilyConfig = await db.query(
            `SELECT api_key, is_active FROM tavily_config WHERE is_active = true LIMIT 1`
        );

        if (tavilyConfig.rows.length === 0) {
            logger.warn('Tavily not configured or inactive, skipping retry processing');
            return { processed: 0, success: 0, failed: 0, skipped: true, reason: 'Tavily not configured' };
        }

        const config = tavilyConfig.rows[0];

        // Note: Budget tracking not currently implemented
        // Process up to limit items
        const processLimit = limit;

        // Get pending items
        const pendingResult = await db.query(`
      SELECT 
        erq.id as queue_id,
        erq.media_item_id,
        erq.attempts,
        erq.max_attempts,
        msi.title,
        msi.year,
        msi.tmdb_id,
        msi.imdb_id,
        msi.media_type
      FROM enrichment_retry_queue erq
      JOIN media_server_items msi ON erq.media_item_id = msi.id
      WHERE erq.status = 'pending' 
        AND erq.enrichment_type = $1
        AND erq.attempts < erq.max_attempts
      ORDER BY erq.priority ASC, erq.created_at ASC
      LIMIT $2
    `, [enrichmentType, processLimit]);

        if (pendingResult.rows.length === 0) {
            logger.info('No pending items in retry queue', { enrichmentType });
            return { processed: 0, success: 0, failed: 0, skipped: false };
        }

        let processed = 0;
        let success = 0;
        let failed = 0;

        for (const item of pendingResult.rows) {
            try {
                // Mark as processing
                await db.query(
                    `UPDATE enrichment_retry_queue SET status = 'processing', last_attempt_at = NOW() WHERE id = $1`,
                    [item.queue_id]
                );

                // Try Tavily enrichment (pass API key from config)
                const result = await this.enrichWithTavily(item, config.api_key);

                if (result.success) {
                    // Update queue status
                    await db.query(
                        `UPDATE enrichment_retry_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
                        [item.queue_id]
                    );

                    // Update media item enrichment status
                    await db.query(
                        `UPDATE media_server_items SET enrichment_status = 'completed' WHERE id = $1`,
                        [item.media_item_id]
                    );

                    success++;
                    logger.info('Tavily enrichment successful', { title: item.title, mediaItemId: item.media_item_id });
                } else {
                    // Increment attempts
                    await db.query(
                        `UPDATE enrichment_retry_queue 
             SET status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
                 attempts = attempts + 1,
                 error_message = $2
             WHERE id = $1`,
                        [item.queue_id, result.error || 'Unknown error']
                    );
                    failed++;
                }

                processed++;
            } catch (error) {
                logger.error('Error processing retry queue item', { error: error.message, item });
                await db.query(
                    `UPDATE enrichment_retry_queue 
           SET status = 'pending', attempts = attempts + 1, error_message = $2 
           WHERE id = $1`,
                    [item.queue_id, error.message]
                );
                failed++;
                processed++;
            }
        }

        logger.info('Retry queue processing complete', { processed, success, failed, enrichmentType });
        return { processed, success, failed, skipped: false };
    }

    /**
     * Enrich a media item using Tavily
     * @param {object} item - Item details from retry queue
     * @param {string} apiKey - Tavily API key
     */
    async enrichWithTavily(item, apiKey) {
        try {
            // Search for IMDb data using Tavily
            const searchQuery = item.imdb_id
                ? `IMDb ${item.imdb_id}`
                : `${item.title} ${item.year || ''} IMDb rating`;

            const searchResult = await tavilyService.search(searchQuery, {
                apiKey,
                searchDepth: 'basic',
                maxResults: 3
            });

            // Tavily returns { results: [...], answer: ... } - extract results array
            const results = searchResult?.results || [];
            if (!results || results.length === 0) {
                return { success: false, error: 'No results found' };
            }

            // Extract IMDb data from search results
            const imdbData = this.extractImdbData(results, item.title);

            if (imdbData) {
                // Update media_server_items metadata with Tavily results
                await db.query(`
          UPDATE media_server_items 
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{tavily_imdb}',
            $2::jsonb
          )
          WHERE id = $1
        `, [item.media_item_id, JSON.stringify(imdbData)]);

                // Successfully enriched with Tavily data

                return { success: true, data: imdbData };
            }

            return { success: false, error: 'Could not extract IMDb data' };
        } catch (error) {
            logger.error('Tavily enrichment failed', { error: error.message, item: item.title });
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract IMDb data from Tavily search results
     * @param {Array} results - Tavily search results
     * @param {string} title - Expected title for matching
     */
    extractImdbData(results, title) {
        for (const result of results) {
            const content = result.content || result.snippet || '';
            const url = result.url || '';

            // Look for IMDb URL
            const imdbMatch = url.match(/imdb\.com\/title\/(tt\d+)/i);

            if (imdbMatch) {
                const data = {
                    imdb_id: imdbMatch[1],
                    source: 'tavily',
                    url: url,
                    fetched_at: new Date().toISOString()
                };

                // Try to extract rating
                const ratingMatch = content.match(/(\d+\.?\d*)\/10/);
                if (ratingMatch) {
                    data.rating = parseFloat(ratingMatch[1]);
                }

                // Try to extract genre
                const genrePatterns = [
                    /\b(Action|Adventure|Animation|Biography|Comedy|Crime|Documentary|Drama|Family|Fantasy|History|Horror|Music|Musical|Mystery|Romance|Sci-Fi|Sport|Thriller|War|Western)\b/gi
                ];
                const genres = [];
                for (const pattern of genrePatterns) {
                    const matches = content.match(pattern);
                    if (matches) {
                        genres.push(...matches.map(g => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()));
                    }
                }
                if (genres.length > 0) {
                    data.genres = [...new Set(genres)];
                }

                return data;
            }
        }

        return null;
    }

    /**
     * Backfill retry queue with items missing OMDb data
     */
    async backfillRetryQueue() {
        const result = await db.query(`
      INSERT INTO enrichment_retry_queue (media_item_id, enrichment_type, reason, priority)
      SELECT 
        msi.id,
        'tavily',
        'OMDb not found - backfill',
        5
      FROM media_server_items msi
      WHERE msi.metadata->'omdb' IS NULL
        AND msi.metadata->'content_analysis' IS NOT NULL
      ON CONFLICT (media_item_id, enrichment_type) DO NOTHING
      RETURNING id
    `);

        logger.info('Backfilled retry queue', { itemsQueued: result.rowCount });
        return { queued: result.rowCount };
    }
}

module.exports = new EnrichmentRetryService();
