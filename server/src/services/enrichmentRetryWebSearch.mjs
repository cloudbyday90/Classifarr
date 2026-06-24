/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { extractImdbData } from './webSearchEnrichmentEvidence.mjs';
import { buildImdbLookupRequest } from './webSearchEnrichmentRequests.mjs';
import { WebSearchProviderRoutingError } from './webSearchProviderRouter.mjs';
import { webSearchEnrichmentService as defaultWebSearchEnrichmentService } from './webSearchEnrichmentService.mjs';

function isLegacyTavilyMonthlyQuotaError(error, enrichmentType) {
  if (enrichmentType !== 'tavily') return false;
  if (error?.code === 'quota_exhausted' && error?.provider === 'tavily') return true;
  return error instanceof WebSearchProviderRoutingError
    && error.lastError?.code === 'quota_exhausted'
    && error.lastError?.providerKey === 'tavily'
    && error.candidates.every((candidate) => (
      candidate.providerKey === 'tavily' || candidate.status !== 'available'
    ));
}

export async function enrichWithWebSearch({
  db,
  webSearchEnrichmentService = defaultWebSearchEnrichmentService,
  logger,
}, item, {
  enrichmentType = 'web_search',
} = {}) {
  try {
    const searchResult = await webSearchEnrichmentService.search(
      buildImdbLookupRequest(item, {
        correlationId: `enrichment-retry:${item.queue_id}`,
      }),
      {
        cacheMetadata: {
          retryQueueId: item.queue_id,
          mediaItemId: item.media_item_id,
        },
      }
    );
    const imdbData = extractImdbData(searchResult.response);

    if (!imdbData) {
      return { success: false, error: 'Could not extract IMDb data' };
    }

    await db.query(
      `UPDATE media_server_items
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{web_search_imdb}',
         $2::jsonb
       )
       WHERE id = $1`,
      [item.media_item_id, JSON.stringify(imdbData)]
    );

    logger.info('Web search enrichment successful', {
      title: item.title,
      mediaItemId: item.media_item_id,
      provider: imdbData.source,
    });
    return { success: true, data: imdbData };
  } catch (error) {
    if (isLegacyTavilyMonthlyQuotaError(error, enrichmentType)) {
      logger.info('Legacy Tavily retry exhausted its monthly quota; deferring item', {
        item: item.title,
        code: error.code || null,
      });
      return {
        success: false,
        error: error.message,
        deferUntilMonthlyReset: true,
      };
    }

    logger.warn('Web search enrichment failed', {
      code: error.code || null,
      error: error.message,
      item: item.title,
    });
    return { success: false, error: error.message };
  }
}

export { extractImdbData };
