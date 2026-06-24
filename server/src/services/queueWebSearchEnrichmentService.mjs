/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { metadataProviderIntegrityService } from './metadataProviderIntegrityService.mjs';
import {
  buildWebSearchAdvisoryEvidence,
  buildWebSearchAnimeEvidence,
  buildWebSearchHolidayEvidence,
} from './webSearchEnrichmentEvidence.mjs';
import {
  buildAnimeRequest,
  buildContentAdvisoryRequest,
  buildHolidayRequest,
} from './webSearchEnrichmentRequests.mjs';
import { webSearchEnrichmentService as defaultWebSearchEnrichmentService } from './webSearchEnrichmentService.mjs';

function isAnimePayload(payload = {}) {
  return payload.original_language === 'ja'
    || normalizeMetadataListLower(payload.genres).some((genre) => genre.includes('anime'));
}

export class QueueWebSearchEnrichmentService {
  constructor(deps = {}) {
    this.logger = deps.logger;
    this.webSearchEnrichmentService = deps.webSearchEnrichmentService || defaultWebSearchEnrichmentService;
    this.metadataProviderIntegrityService = deps.metadataProviderIntegrityService || metadataProviderIntegrityService;
  }

  async runSearch(request, key) {
    try {
      const result = await this.webSearchEnrichmentService.search(request, {
        cacheMetadata: {
          queueEnrichment: key,
        },
      });
      return result.response;
    } catch (error) {
      this.logger.debug('Web search enrichment request failed', {
        enrichment: key,
        code: error.code || null,
        error: error.message,
      });
      return null;
    }
  }

  async enrich(payload, enrichmentData) {
    try {
      if (!await this.webSearchEnrichmentService.hasAvailableProvider()) {
        return enrichmentData;
      }

      const advisory = await this.runSearch(
        buildContentAdvisoryRequest(payload),
        'advisory'
      );
      if (advisory && (advisory.answer || advisory.results?.length > 0)) {
        enrichmentData.web_search_advisory = buildWebSearchAdvisoryEvidence(advisory);
      }

      const holiday = await this.runSearch(
        buildHolidayRequest(payload),
        'holiday'
      );
      if (holiday && (holiday.answer || holiday.results?.length > 0)) {
        enrichmentData.web_search_holiday = buildWebSearchHolidayEvidence(holiday);
      }

      if (isAnimePayload(payload)) {
        const anime = await this.runSearch(
          buildAnimeRequest(payload),
          'anime'
        );
        if (anime && (anime.answer || anime.results?.length > 0)) {
          enrichmentData.web_search_anime = buildWebSearchAnimeEvidence(anime);
        }
      }

      return enrichmentData;
    } catch (error) {
      this.metadataProviderIntegrityService.warnProviderRuntimeFailure({
        provider: 'web_search',
        category: 'queue_failure',
        message: 'Web search enrichment failed',
        metadata: {
          source: 'queue_enrichment',
          code: error.code || null,
          error: error.message,
        },
        dedupeSignature: `${error.code || 'NO_CODE'}:${(error.message || 'unknown_error').toLowerCase()}`,
      });
      return enrichmentData;
    }
  }
}
