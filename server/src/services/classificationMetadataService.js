/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * classificationMetadataService
 *
 * Responsible for all metadata gathering, enrichment, parsing, and merging
 * in the classification pipeline. Extracted from ClassificationService as
 * Phase 1 of the classification.js decomposition.
 *
 * Responsibilities:
 *  - Normalize incoming webhook/payload formats (parseOverseerrPayload)
 *  - Fetch and shape TMDB metadata (enrichWithTMDB)
 *  - Fetch and shape Tavily/web-search data (enrichWithWebSearch)
 *  - Merge a re-fetched enrichment pass with existing metadata (mergeMetadataForRecheck)
 *  - Detect special event types from metadata text (detectEventTypesFromMetadata)
 *  - Detect anime from metadata signals (mightBeAnime)
 *
 * No classification decision logic lives here. All functions are pure
 * transforms or I/O-only operations against external APIs and DB config.
 */

const db = require('../config/database');
const tmdbService = require('./tmdb');
const tavilyService = require('./tavily');
const { createLogger } = require('../utils/logger');
const { normalizeMetadataList, normalizeMetadataListLower } = require('../utils/metadataNormalization');

const logger = createLogger('classificationMetadata');

/**
 * Normalise an incoming webhook/API payload into a consistent shape.
 *
 * Handles three formats:
 *  1. Overseerr webhook  — media.tmdbId / media.media_type / request.seasons
 *  2. Plex gap analysis  — title, tmdb_id at root, itemId, source_library_*
 *  3. Legacy/manual      — title, tmdb_id, media_type at root
 *
 * @param {object} payload - Raw incoming request payload
 * @returns {{ media_type, tmdbId, title, year, existingMetadata, taskId }}
 */
function parseOverseerrPayload(payload) {
  // Extract media type - check multiple locations
  let media_type = payload.media?.media_type || payload.media_type || 'movie';
  if (!media_type && payload.subject) {
    media_type = payload.subject.includes('Movie') ? 'movie' : 'tv';
  }

  // Extract TMDB ID - check multiple locations
  const tmdbId = payload.media?.tmdbId || payload.tmdb_id || payload.extra?.[0]?.value;
  const tvdbId = payload.media?.tvdbId || payload.tvdb_id;
  let requestedSeasons = payload.request?.seasons || payload.requested_seasons;
  if (typeof requestedSeasons === 'string') {
    try {
      requestedSeasons = JSON.parse(requestedSeasons);
    } catch (_error) {
      requestedSeasons = null;
    }
  }

  // Extract title - check multiple locations
  const title = payload.title || payload.subject || payload.media?.title || 'Unknown';

  // Extract year for better search matching
  const year = payload.year || payload.media?.year;

  // For gap analysis items, we might have full metadata already
  const existingMetadata = {
    overview: payload.overview,
    genres: payload.genres,
    keywords: payload.keywords,
    content_rating: payload.content_rating,
    original_language: payload.original_language,
    retry_count: payload.retry_count,
    max_retries: payload.max_retries,
    retry_lineage: payload.retry_lineage,
    itemId: payload.itemId, // Internal ID for updating media_server_items
    source_library_id: payload.source_library_id, // Source Plex library ID
    source_library_name: payload.source_library_name, // Source Plex library name
    requested_seasons: Array.isArray(requestedSeasons) ? requestedSeasons : null,
    include_specials: payload.include_specials === true,
    tvdb_id: tvdbId,
  };

  // Extract taskId if present (injected by queueService)
  const taskId = payload.taskId;

  return { media_type, tmdbId, title, year, existingMetadata, taskId };
}

/**
 * Fetch full metadata for a TMDB ID and shape it into the canonical metadata object.
 *
 * @param {number|string} tmdbId
 * @param {'movie'|'tv'} mediaType
 * @returns {Promise<object>} Canonical metadata object
 */
async function enrichWithTMDB(tmdbId, mediaType) {
  try {
    let details;
    if (mediaType === 'movie') {
      details = await tmdbService.getMovieDetails(tmdbId);
    } else {
      details = await tmdbService.getTVDetails(tmdbId);
    }

    const certification = await tmdbService.getCertification(tmdbId, mediaType);

    // director_name: resolved at enrichment time so it is stored in metadata and
    // available to ragGraphExtractor without a second TMDB fetch.
    // Movie: Director from credits.crew. TV: created_by[0].name (showrunner/creator).
    // credits.crew on TV series lists episode-level crew; there is typically no
    // job === 'Director' at the series level — use created_by instead.
    const director_name = mediaType === 'movie'
      ? (details.credits?.crew?.find(c => c.job === 'Director')?.name || null)
      : (details.created_by?.[0]?.name || null);

    return {
      tmdb_id: tmdbId,
      media_type: mediaType,
      title: details.title || details.name,
      original_title: details.original_title || details.original_name,
      year: details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4),
      overview: details.overview,
      genres: details.genres?.map(g => g.name) || [],
      keywords: details.keywords?.keywords?.map(k => k.name) || details.keywords?.results?.map(k => k.name) || [],
      certification: certification,
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

/**
 * Fetch the active Tavily configuration row from the database.
 *
 * @returns {Promise<object|null>}
 */
async function getTavilyConfig() {
  const result = await db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');
  return result.rows[0] || null;
}

/**
 * Check whether metadata signals suggest this item is anime.
 *
 * @param {object} metadata
 * @returns {boolean}
 */
function mightBeAnime(metadata) {
  const keywords = normalizeMetadataListLower(metadata.keywords);
  const genres = normalizeMetadataListLower(metadata.genres);

  return (
    keywords.includes('anime') ||
    metadata.original_language === 'ja' ||
    genres.includes('anime') ||
    keywords.some(k => ['shounen', 'shoujo', 'seinen', 'isekai', 'mecha'].includes(k))
  );
}

/**
 * Enrich metadata with Tavily web-search results (IMDB, content advisory, anime info).
 * Returns null if Tavily is not configured, quota is exhausted, or a search error occurs.
 *
 * @param {object} metadata - Canonical metadata object (title, year, media_type, etc.)
 * @returns {Promise<{imdb, advisory, anime?}|null>}
 */
async function enrichWithWebSearch(metadata) {
  const tavilyConfig = await getTavilyConfig();
  if (!tavilyConfig || !tavilyConfig.is_active || !tavilyConfig.api_key) {
    return null;
  }

  try {
    const searchOptions = {
      apiKey: tavilyConfig.api_key,
      searchDepth: tavilyConfig.search_depth || 'advanced',
      maxResults: tavilyConfig.max_results || 5,
      includeDomains: tavilyConfig.include_domains || ['imdb.com', 'rottentomatoes.com'],
      excludeDomains: tavilyConfig.exclude_domains || []
    };

    // Search IMDB for additional info
    const imdbResults = await tavilyService.searchIMDB(
      metadata.title,
      metadata.year,
      metadata.media_type,
      searchOptions
    );

    // Get content advisory if needed for classification
    const advisoryResults = await tavilyService.getContentAdvisory(
      metadata.title,
      metadata.year,
      searchOptions
    );

    // If anime is suspected, get anime-specific info
    if (mightBeAnime(metadata)) {
      const animeResults = await tavilyService.searchAnimeInfo(metadata.title, searchOptions);
      return {
        imdb: imdbResults,
        advisory: advisoryResults,
        anime: animeResults
      };
    }

    return {
      imdb: imdbResults,
      advisory: advisoryResults
    };
  } catch (error) {
    const status = error.status || null;
    const isMonthlyResetDeferred = status === 432;
    if (isMonthlyResetDeferred) {
      logger.info('Tavily monthly quota reached; deferring web enrichment until reset', {
        status,
        error: error.message,
        recoverable: true
      });
    } else {
      logger.error('Tavily web enrichment failed', {
        status,
        error: error.message
      });
    }
    return null;
  }
}

/**
 * Detect all matching special event types from metadata text.
 * Used by library rule evaluation for event-type conditions.
 *
 * @param {object} metadata
 * @returns {string[]} Matched event type strings (e.g. ['holiday', 'standup'])
 */
function detectEventTypesFromMetadata(metadata) {
  const normalizedKeywords = normalizeMetadataList(metadata.keywords);
  const normalizedGenres = normalizeMetadataList(metadata.genres);
  const textToSearch = [
    metadata.title || '',
    metadata.overview || '',
    ...normalizedKeywords,
    ...normalizedGenres
  ].join(' ').toLowerCase();

  const eventKeywords = {
    holiday: ['christmas', 'xmas', 'santa', 'halloween', 'thanksgiving', 'easter', 'hanukkah', 'kwanzaa', 'new years eve', 'holiday'],
    sports: ['nfl', 'nba', 'mlb', 'nhl', 'mls', 'fifa', 'super bowl', 'world series', 'olympics', 'championship', 'playoffs'],
    ppv: ['ufc', 'mma', 'boxing', 'wwe', 'wrestling', 'wrestlemania', 'bellator', 'fight night', 'knockout'],
    concert: ['concert', 'live tour', 'music festival', 'live performance', 'symphony', 'orchestra', 'unplugged'],
    standup: ['stand-up', 'standup', 'comedy special', 'comedian', 'comedy tour', 'roast', 'improv'],
    awards: ['oscars', 'academy awards', 'emmys', 'golden globes', 'grammys', 'tony awards', 'bafta', 'red carpet']
  };

  const matchedTypes = [];
  for (const [eventType, keywords] of Object.entries(eventKeywords)) {
    if (keywords.some(kw => textToSearch.includes(kw))) {
      matchedTypes.push(eventType);
    }
  }
  return matchedTypes;
}

/**
 * Intelligently merge a TMDB re-fetch result with the current working metadata.
 *
 * Strategy: prefer the richer value for each field.
 *  - Lists (genres, keywords, cast, production_companies): take the longer list if incoming is non-empty
 *  - Named objects (belongs_to_collection): take the one with the longer name
 *  - Strings (overview, original_title): take the longer non-empty string; for overview
 *    the incoming must be meaningfully longer (≥20 chars more, or existing < 40 chars)
 *
 * @param {object} originalMetadata
 * @param {object|null} enrichedMetadata
 * @returns {object} Merged metadata object
 */
function mergeMetadataForRecheck(originalMetadata, enrichedMetadata) {
  if (!enrichedMetadata) {
    return { ...originalMetadata };
  }

  const merged = { ...originalMetadata };

  const getTrimmedLength = (value) => (
    typeof value === 'string' ? value.trim().length : 0
  );

  const shouldReplaceList = (key) => {
    const incomingList = normalizeMetadataList(enrichedMetadata[key]);
    if (incomingList.length === 0) {
      return false;
    }
    const currentList = normalizeMetadataList(merged[key]);
    if (currentList.length === 0) {
      return true;
    }
    return incomingList.length > currentList.length;
  };

  const shouldReplaceNamedObject = (key) => {
    const currentLength = getTrimmedLength(merged[key]?.name);
    const incomingLength = getTrimmedLength(enrichedMetadata[key]?.name);
    if (incomingLength === 0) {
      return false;
    }
    if (currentLength === 0) {
      return true;
    }
    return incomingLength > currentLength;
  };

  const shouldReplaceString = (key) => {
    const currentLength = getTrimmedLength(merged[key]);
    const incomingLength = getTrimmedLength(enrichedMetadata[key]);
    if (incomingLength === 0) {
      return false;
    }
    if (currentLength === 0) {
      return true;
    }
    if (key === 'overview') {
      return incomingLength > currentLength && (currentLength < 40 || incomingLength - currentLength >= 20);
    }
    return incomingLength > currentLength;
  };

  if (shouldReplaceList('genres')) {
    merged.genres = enrichedMetadata.genres;
  }
  if (shouldReplaceList('keywords')) {
    merged.keywords = enrichedMetadata.keywords;
  }
  if (shouldReplaceNamedObject('belongs_to_collection')) {
    merged.belongs_to_collection = enrichedMetadata.belongs_to_collection;
  }
  if (shouldReplaceList('production_companies')) {
    merged.production_companies = enrichedMetadata.production_companies;
  }
  if (shouldReplaceList('cast')) {
    merged.cast = enrichedMetadata.cast;
  }
  if (shouldReplaceString('original_title')) {
    merged.original_title = enrichedMetadata.original_title;
  }
  if (shouldReplaceString('overview')) {
    merged.overview = enrichedMetadata.overview;
  }

  return merged;
}

module.exports = {
  parseOverseerrPayload,
  enrichWithTMDB,
  getTavilyConfig,
  enrichWithWebSearch,
  mergeMetadataForRecheck,
  detectEventTypesFromMetadata,
  mightBeAnime,
};
