/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const DEFAULT_MAX_RESULTS = 5;
const HARD_MAX_RESULTS = 20;
const DEFAULT_MAX_TEXT_CHARS = 1000;
const DEFAULT_MAX_ANSWER_CHARS = 1200;
const DEFAULT_MAX_TITLE_CHARS = 240;
const DEFAULT_MAX_QUERY_CHARS = 500;
const PROVIDER_KEY_PATTERN = /^[a-z0-9_-]{1,40}$/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\u2060\uFEFF]/g;
const SCRIPT_STYLE_BLOCK_PATTERN = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const HTML_ENTITY_PATTERN = /&(#x?[0-9a-f]+|[a-z]+);/gi;

const HTML_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
});

function addWarning(warnings, code) {
  const existing = warnings.find((warning) => warning.code === code);
  if (existing) {
    existing.count += 1;
  } else {
    warnings.push({ code, count: 1 });
  }
}

export function clampWebSearchResultCount(value, {
  fallback = DEFAULT_MAX_RESULTS,
  min = 1,
  max = HARD_MAX_RESULTS,
} = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeWebSearchProviderKey(provider) {
  const normalized = String(provider || 'unknown').trim().toLowerCase();
  return PROVIDER_KEY_PATTERN.test(normalized) ? normalized : 'unknown';
}

export function decodeBasicHtmlEntities(value) {
  if (!value) return '';
  return String(value).replace(HTML_ENTITY_PATTERN, (match, entity) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
        ? String.fromCodePoint(codePoint)
        : match;
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return HTML_ENTITIES[normalized] ?? match;
  });
}

export function sanitizeWebSearchText(value) {
  if (value == null) return '';
  return decodeBasicHtmlEntities(String(value))
    .replace(SCRIPT_STYLE_BLOCK_PATTERN, ' ')
    .replace(HTML_TAG_PATTERN, ' ')
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(ZERO_WIDTH_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateWebSearchText(value, maxChars = DEFAULT_MAX_TEXT_CHARS) {
  const normalized = sanitizeWebSearchText(value);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function normalizeWebSearchUrl(value) {
  if (!value || typeof value !== 'string') {
    return { url: null, sourceDomain: null };
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { url: null, sourceDomain: null };
    }

    return {
      url: parsed.toString(),
      sourceDomain: parsed.hostname.replace(/^www\./i, '').toLowerCase(),
    };
  } catch {
    return { url: null, sourceDomain: null };
  }
}

export function normalizeWebSearchRank(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(HARD_MAX_RESULTS, parsed);
}

export function normalizeWebSearchScore(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (parsed <= 1) return parsed;
  if (parsed <= 100) return Number((parsed / 100).toFixed(4));
  return null;
}

export function normalizeWebSearchPublishedAt(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = sanitizeWebSearchText(value);
  if (!trimmed || /\b(ago|yesterday|today|hour|minute|day|week|month)\b/i.test(trimmed)) {
    return null;
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function getRawResults(rawResponse) {
  if (Array.isArray(rawResponse?.results)) return rawResponse.results;
  if (Array.isArray(rawResponse?.organic)) return rawResponse.organic;
  if (Array.isArray(rawResponse?.web?.results)) return rawResponse.web.results;
  return [];
}

function getResultUrl(result) {
  return result.url || result.link || result.href;
}

function getResultSnippet(result) {
  return result.content || result.snippet || result.description || result.text;
}

function getResultDate(result) {
  return result.published_date || result.publishedAt || result.date || result.age || null;
}

export function normalizeWebSearchResults({
  provider = 'unknown',
  query = '',
  rawResponse = {},
  maxResults = DEFAULT_MAX_RESULTS,
  maxTextChars = DEFAULT_MAX_TEXT_CHARS,
  providerRequestId = null,
} = {}) {
  const providerKey = normalizeWebSearchProviderKey(provider);
  const count = clampWebSearchResultCount(maxResults);
  const warnings = [];
  const rawResults = getRawResults(rawResponse);

  const results = rawResults
    .slice(0, count)
    .map((result, index) => {
      if (!result || typeof result !== 'object') {
        addWarning(warnings, 'dropped_non_object_result');
        return null;
      }

      const { url, sourceDomain } = normalizeWebSearchUrl(getResultUrl(result));
      if (!url) {
        addWarning(warnings, 'dropped_invalid_url');
        return null;
      }

      const title = truncateWebSearchText(result.title, DEFAULT_MAX_TITLE_CHARS);
      const snippet = truncateWebSearchText(getResultSnippet(result), maxTextChars);
      if (!title && !snippet) {
        addWarning(warnings, 'dropped_empty_result');
        return null;
      }

      const rawRank = result.rank ?? result.position;
      const rank = normalizeWebSearchRank(rawRank, index + 1);
      const score = normalizeWebSearchScore(result.score);
      const publishedAt = normalizeWebSearchPublishedAt(getResultDate(result));

      const parsedRawRank = Number.parseInt(rawRank, 10);
      if (rawRank != null && (!Number.isFinite(parsedRawRank) || parsedRawRank < 1)) {
        addWarning(warnings, 'normalized_invalid_rank');
      }
      if (result.score != null && score == null) {
        addWarning(warnings, 'dropped_invalid_score');
      }
      if (getResultDate(result) && !publishedAt) {
        addWarning(warnings, 'dropped_invalid_date');
      }

      return {
        title,
        url,
        snippet,
        rank,
        score,
        publishedAt,
        sourceDomain,
        providerMetadata: {},
      };
    })
    .filter(Boolean);

  return {
    provider: providerKey,
    providerRequestId,
    query: truncateWebSearchText(query, DEFAULT_MAX_QUERY_CHARS),
    answer: truncateWebSearchText(rawResponse?.answer, DEFAULT_MAX_ANSWER_CHARS),
    results,
    usage: {
      costUnits: 1,
      quotaBucket: null,
    },
    warnings,
  };
}

export function hasNormalizedWebSearchResults(normalized) {
  return Array.isArray(normalized?.results) && normalized.results.length > 0;
}

export function formatNormalizedWebSearchForAI(normalized, {
  maxResults = DEFAULT_MAX_RESULTS,
  maxSnippetChars = DEFAULT_MAX_TEXT_CHARS,
  maxAnswerChars = DEFAULT_MAX_ANSWER_CHARS,
} = {}) {
  if (!hasNormalizedWebSearchResults(normalized) && !normalized?.answer) {
    return 'No additional information found.';
  }

  const provider = normalizeWebSearchProviderKey(normalized.provider);
  const lines = [`Web Search Results (${provider}):`, ''];
  const count = clampWebSearchResultCount(maxResults);

  for (const result of normalized.results.slice(0, count)) {
    lines.push(`Source: ${result.url}`);
    if (result.title) {
      lines.push(`Title: ${truncateWebSearchText(result.title, 240)}`);
    }
    if (result.snippet) {
      lines.push(`Content: ${truncateWebSearchText(result.snippet, maxSnippetChars)}`);
    }
    lines.push('');
  }

  if (normalized.answer) {
    lines.push(`Summary: ${truncateWebSearchText(normalized.answer, maxAnswerChars)}`);
  }

  return lines.join('\n').trimEnd();
}

export function formatWebSearchResponseForAI(rawResponse, options = {}) {
  const normalized = normalizeWebSearchResults({
    provider: options.provider || 'unknown',
    query: options.query || rawResponse?.query || '',
    rawResponse,
    maxResults: options.maxResults,
    maxTextChars: options.maxTextChars,
    providerRequestId: options.providerRequestId || null,
  });

  return formatNormalizedWebSearchForAI(normalized, options);
}
