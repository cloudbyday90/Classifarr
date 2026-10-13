/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ValidationError } from '../utils/appError.mjs';
import { canonicalMediaType, payloadMediaType, positiveDatabaseInteger } from './mediaIdentityValues.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.hasOwn(value, key) ? value[key] : undefined;
const boundedInteger = value => typeof value === 'string' && value.length > 32 ? null : positiveDatabaseInteger(value);
const imdb = value => typeof value === 'string' && /^tt[0-9]{1,12}$/u.test(value) ? value : null;
const EXTRA_PROVIDERS = new Map(['tmdb', 'imdb', 'tvdb'].flatMap(provider =>
  [provider, `${provider}id`, `${provider} id`, `${provider}_id`, `${provider}-id`].map(label => [label, provider])));

/** Shared exact-label vocabulary for reading and repairing legacy declarations. */
export function requestExtraIdentityProvider(name) {
  return typeof name === 'string' && name.length <= 64 ? EXTRA_PROVIDERS.get(name.trim().toLowerCase()) : undefined;
}

function agree(values, parse) {
  const parsed = values.filter(value => value != null).map(parse);
  if (parsed.some(value => value === null)) return { value: null, reason: 'invalid' };
  if (new Set(parsed).size > 1) return { value: null, reason: 'conflict' };
  return { value: parsed[0] ?? null, reason: null };
}

/** Fixed, bounded declarations only. Normalization is not approval or a remap. */
export function normalizeRequestIdentity(payload) {
  const result = { mediaType: null, mediaTypeDeclared: false, tmdbId: null, imdbId: null, tvdbId: null, reason: null, externalReason: null };
  const invalid = () => ({ ...result, reason: 'request_identity_invalid' });
  if (!object(payload) || (payload.media != null && !object(payload.media))) return invalid();
  result.mediaType = payloadMediaType(payload);
  const types = [own(payload, 'media_type'), own(payload, 'mediaType'),
    own(payload.media, 'media_type'), own(payload.media, 'mediaType')].filter(value => value !== undefined);
  result.mediaTypeDeclared = types.length > 0;
  if (new Set(types.map(canonicalMediaType).filter(Boolean)).size > 1) {
    return { ...result, reason: 'request_identity_conflict' };
  }
  if (types.some(value => canonicalMediaType(value)) && types.some(value => !canonicalMediaType(value))) return invalid();
  const values = Object.fromEntries(['tmdb', 'imdb', 'tvdb'].map(provider => [provider,
    [own(payload, `${provider}_id`), own(payload, `${provider}Id`),
      own(payload.media, `${provider}_id`), own(payload.media, `${provider}Id`)]]));
  if (payload.extra != null) {
    if (!Array.isArray(payload.extra) || payload.extra.length > 64) return invalid();
    for (const entry of payload.extra) {
      if (!object(entry)) return invalid();
      // Episode/season entries are also stored here; they do not declare an ID.
      if (!Object.hasOwn(entry, 'name')) continue;
      if (typeof entry.name !== 'string' || entry.name.length > 64) return invalid();
      const name = entry.name.trim().toLowerCase();
      const provider = requestExtraIdentityProvider(name);
      // Older readers matched any label containing tmdb; never reinterpret it as absence.
      if (!provider && name.includes('tmdb')) return invalid();
      if (provider && !Object.hasOwn(entry, 'value')) return invalid();
      if (provider) values[provider].push(entry.value);
    }
  }
  const tmdb = agree(values.tmdb, boundedInteger);
  result.tmdbId = tmdb.value;
  if (tmdb.reason) result.reason = `request_identity_${tmdb.reason}`;
  const external = [agree(values.imdb, imdb),
    result.mediaType === 'tv' ? agree(values.tvdb, boundedInteger) : { value: null, reason: null }];
  [result.imdbId, result.tvdbId] = external.map(value => value.value);
  if (external.some(value => value.reason === 'invalid')) result.externalReason = 'invalid_external_id';
  else if (external.some(value => value.reason)) result.externalReason = 'conflicting_external_ids';
  return result;
}

export function requireRequestIdentity(payload) {
  const identity = normalizeRequestIdentity(payload);
  if (identity.reason || identity.externalReason) throw new ValidationError('Request identity is invalid or conflicting; review its saved IDs.',
    { code: identity.reason || identity.externalReason });
  return identity;
}
