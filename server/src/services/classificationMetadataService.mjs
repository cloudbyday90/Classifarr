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
import { tmdbService } from './tmdb.mjs';
import { tavilyService } from './tavily.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  detectEventTypesFromMetadata,
  mergeMetadataForRecheck as mergeMetadataForRecheckImpl,
  mightBeAnime,
  parseOverseerrPayload,
} from './classificationMetadataServiceShared.mjs';
import {
  buildTavilySearchOptions,
  buildWebSearchResult,
  isMonthlyQuotaDeferredStatus,
} from './classificationMetadataWebSearchShared.mjs';

const logger = createLogger('classificationMetadata');

async function enrichWithTMDBImpl(tmdbId, mediaType) {
  try {
    let details;
    if (mediaType === 'movie') {
      details = await tmdbService.getMovieDetails(tmdbId);
    } else {
      details = await tmdbService.getTVDetails(tmdbId);
    }

    const certification = await tmdbService.getCertification(tmdbId, mediaType);
    const director_name = mediaType === 'movie'
      ? (details.credits?.crew?.find((crewMember) => crewMember.job === 'Director')?.name || null)
      : (details.created_by?.[0]?.name || null);

    return {
      tmdb_id: tmdbId,
      media_type: mediaType,
      title: details.title || details.name,
      original_title: details.original_title || details.original_name,
      year: details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4),
      overview: details.overview,
      genres: details.genres?.map((genre) => genre.name) || [],
      keywords: details.keywords?.keywords?.map((keyword) => keyword.name) || details.keywords?.results?.map((keyword) => keyword.name) || [],
      certification,
      rating: details.vote_average,
      popularity: details.popularity,
      original_language: details.original_language,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      belongs_to_collection: details.belongs_to_collection || null,
      production_companies: Array.isArray(details.production_companies) ? details.production_companies : [],
      cast: Array.isArray(details.credits?.cast) ? details.credits.cast.slice(0, 10) : [],
      director_name,
    };
  } catch (error) {
    throw new Error(`Failed to enrich metadata: ${error.message}`);
  }
}

export async function enrichWithTMDB(...args) {
  return enrichWithTMDBImpl(...args);
}

export async function getTavilyConfig() {
  const result = await db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');
  return result.rows[0] || null;
}

export async function enrichWithWebSearch(metadata) {
  const tavilyConfig = await getTavilyConfig();
  if (!tavilyConfig || !tavilyConfig.is_active || !tavilyConfig.api_key) {
    return null;
  }

  try {
    const searchOptions = buildTavilySearchOptions(tavilyConfig);

    const imdbResults = await tavilyService.searchIMDB(
      metadata.title,
      metadata.year,
      metadata.media_type,
      searchOptions,
    );

    const advisoryResults = await tavilyService.getContentAdvisory(
      metadata.title,
      metadata.year,
      searchOptions,
    );

    if (mightBeAnime(metadata)) {
      const animeResults = await tavilyService.searchAnimeInfo(metadata.title, searchOptions);
      return buildWebSearchResult({ imdbResults, advisoryResults, animeResults });
    }

    return buildWebSearchResult({ imdbResults, advisoryResults });
  } catch (error) {
    const status = error.status || null;
    const isMonthlyResetDeferred = isMonthlyQuotaDeferredStatus(status);
    if (isMonthlyResetDeferred) {
      logger.info('Tavily monthly quota reached; deferring web enrichment until reset', {
        status,
        error: error.message,
        recoverable: true,
      });
    } else {
      logger.error('Tavily web enrichment failed', {
        status,
        error: error.message,
      });
    }
    return null;
  }
}

export function mergeMetadataForRecheck(...args) {
  return mergeMetadataForRecheckImpl(...args);
}

export const classificationMetadataService = {
  detectEventTypesFromMetadata,
  enrichWithTMDB,
  enrichWithWebSearch,
  getTavilyConfig,
  mergeMetadataForRecheck,
  mightBeAnime,
  parseOverseerrPayload,
};

export {
  detectEventTypesFromMetadata,
  mightBeAnime,
  parseOverseerrPayload,
} from './classificationMetadataServiceShared.mjs';
