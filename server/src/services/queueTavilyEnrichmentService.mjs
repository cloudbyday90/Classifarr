/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { metadataProviderIntegrityService } from './metadataProviderIntegrityService.mjs';
import { tavilyService } from './tavily.mjs';

export class QueueTavilyEnrichmentService {
    constructor(deps = {}) {
        this.db = deps.db;
        this.logger = deps.logger;
        this.metadataProviderIntegrityService = deps.metadataProviderIntegrityService || metadataProviderIntegrityService;
    }

    async enrich(payload, enrichmentData) {
        try {
            const tavilyConfig = await this.db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');

            if (tavilyConfig.rows.length === 0 || !tavilyConfig.rows[0].api_key) {
                return enrichmentData;
            }

            const config = tavilyConfig.rows[0];

            const searchOptions = {
                apiKey: config.api_key,
                searchDepth: config.search_depth || 'advanced',
                maxResults: config.max_results || 3
            };

            try {
                const advisoryResults = await tavilyService.getContentAdvisory(
                    payload.title,
                    payload.year,
                    searchOptions
                );

                if (advisoryResults?.results?.length > 0) {
                    enrichmentData.tavily_advisory = {
                        fetched_at: new Date().toISOString(),
                        content: advisoryResults.results[0]?.content?.substring(0, 1000),
                        answer: advisoryResults.answer
                    };
                }
            } catch (advisoryError) {
                this.logger.debug('Tavily advisory search failed', { error: advisoryError.message });
            }

            try {
                const holidayQuery = `${payload.title} ${payload.year} Christmas OR holiday OR seasonal movie`;
                const holidayResults = await tavilyService.search(holidayQuery, {
                    ...searchOptions,
                    includeDomains: ['imdb.com', 'wikipedia.org'],
                    maxResults: 2
                });
                if (holidayResults?.answer) {
                    enrichmentData.tavily_holiday = {
                        fetched_at: new Date().toISOString(),
                        answer: holidayResults.answer
                    };
                }
            } catch (holidayError) {
                this.logger.debug('Tavily holiday search failed', { error: holidayError.message });
            }

            const isAnime = payload.original_language === 'ja' ||
                normalizeMetadataListLower(payload.genres).some(g => g.includes('anime'));

            if (isAnime) {
                try {
                    const animeResults = await tavilyService.searchAnimeInfo(
                        payload.title,
                        searchOptions
                    );

                    if (animeResults?.results?.length > 0) {
                        enrichmentData.tavily_anime = {
                            fetched_at: new Date().toISOString(),
                            results: animeResults.results.slice(0, 2).map(r => ({
                                url: r.url,
                                title: r.title,
                                snippet: r.content?.substring(0, 500)
                            })),
                            answer: animeResults.answer
                        };
                    }
                } catch (animeError) {
                    this.logger.debug('Tavily anime search failed', { error: animeError.message });
                }
            }

            return enrichmentData;
        } catch (tavilyError) {
            this.metadataProviderIntegrityService.warnProviderRuntimeFailure({
                provider: 'tavily',
                category: 'queue_failure',
                message: 'Tavily enrichment failed',
                metadata: {
                    source: 'queue_enrichment',
                    code: tavilyError.code || null,
                    error: tavilyError.message,
                },
                dedupeSignature: `${tavilyError.code || 'NO_CODE'}:${(tavilyError.message || 'unknown_error').toLowerCase()}`,
            });
            return enrichmentData;
        }
    }
}
