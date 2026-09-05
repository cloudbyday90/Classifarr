/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { normalizeSourceProviderIds } from '../../mediaSourceIdentity.mjs';

const emptyIds = () => ({ tmdb_id: null, imdb_id: null, tvdb_id: null });

function validatedIds(ids) {
  return normalizeSourceProviderIds(ids) || { ...emptyIds(), provider_identity_invalid: true };
}

/** @param {Record<string, unknown>} providerIds */
export function parseProviderIds(providerIds = {}) {
  if (!providerIds || typeof providerIds !== 'object' || Array.isArray(providerIds)) {
    return { ...emptyIds(), provider_identity_invalid: true };
  }
  return validatedIds({ tmdb_id: providerIds.Tmdb, imdb_id: providerIds.Imdb, tvdb_id: providerIds.Tvdb });
}

export function parsePlexGuids(guids = []) {
  const result = emptyIds();
  if (!Array.isArray(guids)) return { ...result, provider_identity_invalid: true };
  for (const guid of guids) {
    const id = typeof guid?.id === 'string' ? guid.id : '';
    const provider = /^(tmdb|imdb|tvdb):\/\//.exec(id)?.[1];
    if (!provider) continue;
    const field = `${provider}_id`;
    const parsed = validatedIds({ [field]: id.slice(provider.length + 3) });
    if (parsed.provider_identity_invalid || parsed[field] == null ||
        (result[field] != null && result[field] !== parsed[field])) return { ...emptyIds(), provider_identity_invalid: true };
    result[field] = parsed[field];
  }

  return result;
}
