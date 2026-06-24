/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function buildMedia(metadata = {}) {
  return {
    title: metadata.title,
    year: metadata.year,
    mediaType: metadata.media_type || metadata.mediaType || 'unknown',
    tmdbId: metadata.tmdb_id || metadata.tmdbId,
  };
}

function buildRequest({
  purpose,
  query,
  metadata,
  maxResults,
  domains,
  traceContext,
}) {
  return {
    purpose,
    query,
    media: buildMedia(metadata),
    options: {
      maxResults,
      includeAnswer: true,
      safeSearch: true,
      domains,
    },
    traceContext: traceContext || {},
  };
}

export function buildImdbLookupRequest(metadata = {}, traceContext = {}) {
  const query = metadata.imdb_id
    ? `IMDb ${metadata.imdb_id}`
    : `${metadata.title} ${metadata.year || ''} ${metadata.media_type || metadata.mediaType || ''} IMDb`;

  return buildRequest({
    purpose: 'metadata_enrichment',
    query,
    metadata,
    maxResults: 3,
    domains: ['imdb.com'],
    traceContext,
  });
}

export function buildContentAdvisoryRequest(metadata = {}, traceContext = {}) {
  return buildRequest({
    purpose: 'content_advisory',
    query: `${metadata.title} ${metadata.year || ''} IMDb parents guide content advisory`,
    metadata,
    maxResults: 2,
    domains: ['imdb.com'],
    traceContext,
  });
}

export function buildHolidayRequest(metadata = {}, traceContext = {}) {
  return buildRequest({
    purpose: 'holiday',
    query: `${metadata.title} ${metadata.year || ''} Christmas OR holiday OR seasonal movie`,
    metadata,
    maxResults: 2,
    domains: ['imdb.com', 'wikipedia.org'],
    traceContext,
  });
}

export function buildAnimeRequest(metadata = {}, traceContext = {}) {
  return buildRequest({
    purpose: 'anime',
    query: `${metadata.title} anime MyAnimeList`,
    metadata,
    maxResults: 3,
    domains: ['myanimelist.net', 'anilist.co', 'anidb.net'],
    traceContext,
  });
}
