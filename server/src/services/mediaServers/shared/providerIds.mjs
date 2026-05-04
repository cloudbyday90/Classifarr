/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function parseNumericId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseProviderIds(providerIds = {}) {
  return {
    tmdb_id: parseNumericId(providerIds.Tmdb),
    imdb_id: providerIds.Imdb || null,
    tvdb_id: parseNumericId(providerIds.Tvdb),
  };
}

function parsePlexGuids(guids = []) {
  const result = {
    tmdb_id: null,
    imdb_id: null,
    tvdb_id: null,
  };

  for (const guid of guids) {
    const id = typeof guid?.id === 'string' ? guid.id : '';
    if (id.startsWith('tmdb://')) {
      result.tmdb_id = parseNumericId(id.replace('tmdb://', ''));
      continue;
    }

    if (id.startsWith('imdb://')) {
      result.imdb_id = id.replace('imdb://', '');
      continue;
    }

    if (id.startsWith('tvdb://')) {
      result.tvdb_id = parseNumericId(id.replace('tvdb://', ''));
    }
  }

  return result;
}

const providerIds = {
  parseProviderIds,
  parsePlexGuids,
};

export default providerIds;
export { parseProviderIds, parsePlexGuids };
