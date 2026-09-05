/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { canonicalMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

const TMDB_IDENTITY_RESULT_LIMIT = 20;

export function normalizeIdentityTitle(value) {
  if (typeof value !== 'string' || value.length > 500 || !value.trim()) return null;
  return value.normalize('NFC').toLowerCase().normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function identityYear(value) {
  if (typeof value === 'string' && /^[1-9][0-9]{3}$/u.test(value.trim())) return Number(value.trim());
  return Number.isInteger(value) && value >= 1000 && value <= 9999 ? value : null;
}

export function buildTmdbTitleRequest(title, mediaType, year) {
  const normalizedTitle = normalizeIdentityTitle(title);
  const type = canonicalMediaType(mediaType);
  const normalizedYear = identityYear(year);
  if (!normalizedTitle || !type || !normalizedYear) return null;
  return Object.freeze({ title: title.trim(), normalizedTitle, mediaType: type, year: normalizedYear });
}

function releaseYear(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? year : null;
}

const abstain = (reason) => Object.freeze({ tmdbId: null, reason });

/** Completeness is relative to this bounded provider response, not all real-world media. */
export function decideTmdbTitleMatch(request, response) {
  request = buildTmdbTitleRequest(request?.title, request?.mediaType, request?.year);
  if (!request) return abstain('invalid_request');
  if (!response || response.page !== 1 || !Array.isArray(response.results) ||
      !Number.isInteger(response.total_results) || response.total_results < 0 ||
      !Number.isInteger(response.total_pages) || response.total_pages < 0) return abstain('invalid_response');
  if (response.total_pages > 1 || response.total_results > TMDB_IDENTITY_RESULT_LIMIT ||
      response.results.length > TMDB_IDENTITY_RESULT_LIMIT) return abstain('incomplete_results');
  if (response.total_results !== response.results.length ||
      (response.total_results > 0 && response.total_pages !== 1)) return abstain('invalid_response');

  const seen = new Set();
  const matches = [];
  for (const row of response.results) {
    const id = positiveDatabaseInteger(row?.id);
    const type = row?.media_type === undefined ? request.mediaType : canonicalMediaType(row.media_type);
    const localized = request.mediaType === 'movie' ? row?.title : row?.name;
    const original = request.mediaType === 'movie' ? row?.original_title : row?.original_name;
    const titles = [localized, original].filter((value) => value !== undefined).map(normalizeIdentityTitle);
    const year = releaseYear(request.mediaType === 'movie' ? row?.release_date : row?.first_air_date);
    if (!id || type !== request.mediaType || seen.has(id) || !titles.length || titles.some((title) => !title) || !year) {
      return abstain('invalid_response');
    }
    seen.add(id);
    if (year === request.year && titles.includes(request.normalizedTitle)) matches.push(id);
  }
  if (matches.length !== 1) return abstain(matches.length ? 'ambiguous_title_year' : 'no_exact_title_year_match');
  return Object.freeze({ tmdbId: matches[0], reason: 'exact_title_year_match' });
}
