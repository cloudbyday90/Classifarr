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

const providerFields = Object.freeze(['tmdb_id', 'imdb_id', 'tvdb_id']);
const maximumPlexGuidsForIdentityEvidence = 100;

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
    if (parsed.provider_identity_invalid || parsed[field] == null) {
      return { ...emptyIds(), provider_identity_invalid: true, provider_identity_field: field };
    }
    if (result[field] != null && result[field] !== parsed[field]) {
      return { ...emptyIds(), provider_identity_invalid: true,
        provider_identity_issue: 'conflicting_provider_ids', provider_identity_field: field };
    }
    result[field] = parsed[field];
  }

  return result;
}

/**
 * Normalizes provider values while retaining all distinct declarations in
 * memory. This is deliberately separate from the normal sync parser: a
 * conflicting source item remains invalid for sync, but a read-only evidence
 * replay needs to compare the complete current candidate set without storing
 * or logging those values.
 */
/** @param {Record<string, unknown>} providerIds */
export function collectProviderIdCandidates(providerIds = {}) {
  if (!providerIds || typeof providerIds !== 'object' || Array.isArray(providerIds)) return null;
  const normalized = validatedIds({
    tmdb_id: providerIds.Tmdb,
    imdb_id: providerIds.Imdb,
    tvdb_id: providerIds.Tvdb,
  });
  if (normalized.provider_identity_invalid) return null;
  return Object.freeze(Object.fromEntries(providerFields.map((field) => Object.freeze([
    field,
    Object.freeze(normalized[field] == null ? [] : [normalized[field]]),
  ]))));
}

/** Returns every valid Plex GUID declaration for each supported provider. */
export function collectPlexGuidCandidates(guids = []) {
  if (!Array.isArray(guids) || guids.length > maximumPlexGuidsForIdentityEvidence) return null;
  const candidates = Object.fromEntries(providerFields.map((field) => [field, new Set()]));
  for (const guid of guids) {
    const id = typeof guid?.id === 'string' ? guid.id : '';
    const provider = /^(tmdb|imdb|tvdb):\/\//.exec(id)?.[1];
    if (!provider) continue;
    const field = `${provider}_id`;
    const parsed = validatedIds({ [field]: id.slice(provider.length + 3) });
    if (parsed.provider_identity_invalid || parsed[field] == null) return null;
    candidates[field].add(parsed[field]);
  }
  return Object.freeze(Object.fromEntries(providerFields.map((field) => Object.freeze([
    field,
    Object.freeze([...candidates[field]].sort((left, right) => String(left).localeCompare(String(right)))),
  ]))));
}
