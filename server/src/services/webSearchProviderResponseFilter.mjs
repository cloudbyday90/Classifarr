/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { clampWebSearchResultCount } from './webSearchResultNormalizer.mjs';

function normalizeDomains(domains = []) {
  if (!Array.isArray(domains)) return [];
  return [...new Set(domains
    .map((domain) => String(domain || '').trim().toLowerCase())
    .filter(Boolean))];
}

function matchesDomain(sourceDomain, requestedDomain) {
  return sourceDomain === requestedDomain || sourceDomain.endsWith(`.${requestedDomain}`);
}

function appendWarning(warnings, code, count) {
  if (count < 1) return warnings;
  const existing = warnings.find((warning) => warning.code === code);
  if (existing) {
    return warnings.map((warning) => (
      warning === existing ? { ...warning, count: warning.count + count } : warning
    ));
  }
  return [...warnings, { code, count }];
}

/**
 * Enforces caller-requested domains after normalization for providers without a
 * first-class domain filter. This guarantees that provider-specific query
 * syntax cannot weaken the common web-search request contract.
 */
export function filterWebSearchResponseByDomains(response = {}, domains = [], { maxResults } = {}) {
  const requestedDomains = normalizeDomains(domains);
  const resultLimit = clampWebSearchResultCount(maxResults);
  const results = Array.isArray(response.results) ? response.results : [];

  if (requestedDomains.length === 0) {
    return {
      ...response,
      results: results.slice(0, resultLimit),
    };
  }

  const filtered = results.filter((result) => requestedDomains.some((domain) => (
    matchesDomain(result.sourceDomain, domain)
  )));

  return {
    ...response,
    results: filtered.slice(0, resultLimit),
    warnings: appendWarning(
      Array.isArray(response.warnings) ? response.warnings : [],
      'dropped_domain_mismatch',
      results.length - filtered.length
    ),
  };
}
