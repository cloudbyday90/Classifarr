/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const MAX_EVIDENCE_RESULTS = 3;
const MAX_EVIDENCE_SNIPPET_CHARS = 1000;
const MAX_ANIME_SNIPPET_CHARS = 500;

function truncate(value, maxChars) {
  const text = String(value || '');
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function buildBaseEvidence(response = {}, fetchedAt) {
  return {
    provider: response.provider || 'unknown',
    provider_request_id: response.providerRequestId || null,
    query: response.query || '',
    fetched_at: fetchedAt,
    answer: response.answer || '',
  };
}

export function buildWebSearchEvidence(response = {}, {
  fetchedAt = new Date().toISOString(),
  maxResults = MAX_EVIDENCE_RESULTS,
  maxSnippetChars = MAX_EVIDENCE_SNIPPET_CHARS,
} = {}) {
  return {
    ...buildBaseEvidence(response, fetchedAt),
    results: (Array.isArray(response.results) ? response.results : [])
      .slice(0, maxResults)
      .map((result) => ({
        url: result.url,
        title: result.title,
        snippet: truncate(result.snippet, maxSnippetChars),
        source_domain: result.sourceDomain,
        rank: result.rank,
        score: result.score,
      })),
  };
}

export function buildWebSearchAdvisoryEvidence(response, options = {}) {
  const evidence = buildWebSearchEvidence(response, options);
  return {
    ...evidence,
    content: evidence.results[0]?.snippet || '',
  };
}

export function buildWebSearchHolidayEvidence(response, options = {}) {
  return buildWebSearchEvidence(response, {
    ...options,
    maxResults: 2,
  });
}

export function buildWebSearchAnimeEvidence(response, options = {}) {
  const evidence = buildWebSearchEvidence(response, {
    ...options,
    maxResults: 2,
    maxSnippetChars: MAX_ANIME_SNIPPET_CHARS,
  });

  return {
    ...evidence,
    results: evidence.results.map((result) => ({
      url: result.url,
      title: result.title,
      snippet: result.snippet,
      source_domain: result.source_domain,
    })),
  };
}

export function extractImdbData(response = {}) {
  const normalizedResponse = Array.isArray(response)
    ? {
      provider: 'tavily',
      results: response.map((result) => ({
        ...result,
        snippet: result?.snippet || result?.content || '',
      })),
    }
    : response;

  for (const result of normalizedResponse.results || []) {
    const url = result.url || '';
    const snippet = result.snippet || '';
    const imdbMatch = url.match(/imdb\.com\/title\/(tt\d+)/i);

    if (!imdbMatch) continue;

    const data = {
      imdb_id: imdbMatch[1],
      source: normalizedResponse.provider || 'unknown',
      provider_request_id: normalizedResponse.providerRequestId || null,
      url,
      fetched_at: new Date().toISOString(),
    };

    const ratingMatch = snippet.match(/(\d+\.?\d*)\/10/);
    if (ratingMatch) {
      data.rating = Number.parseFloat(ratingMatch[1]);
    }

    const genres = [...snippet.matchAll(
      /\b(Action|Adventure|Animation|Biography|Comedy|Crime|Documentary|Drama|Family|Fantasy|History|Horror|Music|Musical|Mystery|Romance|Sci-Fi|Sport|Thriller|War|Western)\b/gi
    )].map((match) => match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase());

    if (genres.length > 0) {
      data.genres = [...new Set(genres)];
    }

    return data;
  }

  return null;
}
