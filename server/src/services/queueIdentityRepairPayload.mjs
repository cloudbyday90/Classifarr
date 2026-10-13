/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ConflictError } from '../utils/appError.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { normalizeRequestIdentity, requestExtraIdentityProvider } from './requestIdentityNormalization.mjs';

const ID_KEYS = ['tmdb_id', 'tmdbId', 'imdb_id', 'imdbId', 'tvdb_id', 'tvdbId', 'media_type', 'mediaType'];
const REQUEST_KEYS = new Set([...ID_KEYS, 'media', 'extra', 'title', 'year',
  'notification_type', 'event_name', 'request_id', 'poster_path', 'is_4k',
  'requested_by_username', 'requested_by_email', 'requested_by_avatar',
  'requested_seasons', 'requested_at', 'media_status', 'media_status_4k', 'include_specials']);
const MEDIA_KEYS = new Set([...ID_KEYS, 'title', 'year', 'poster_path']);
const COORDINATE_KEYS = new Set(['seasonNumber', 'season_number', 'season', 'seasonIndex', 'season_index',
  'episodeNumber', 'episode_number', 'episode']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unsupported = () => new ConflictError('This request format needs a separately reviewed repair.',
  { code: 'queue_identity_repair_unsupported' });

function supportedExtra(entry) {
  if (!object(entry)) return false;
  if (Object.hasOwn(entry, 'name')) return Boolean(requestExtraIdentityProvider(entry.name)) &&
    Object.keys(entry).every(key => key === 'name' || key === 'value');
  return Object.keys(entry).every(key => COORDINATE_KEYS.has(key) &&
    ['string', 'number'].includes(typeof entry[key]));
}

/** Deliberately narrower than diagnostic reads: no cached metadata or unknown contexts. */
export function assertRepairRequest(payload, repaired = false) {
  if (!object(payload) || Buffer.byteLength(JSON.stringify(payload), 'utf8') > 65536 ||
      Object.keys(payload).some(key => !REQUEST_KEYS.has(key) && !(repaired && key === 'identity_repair')) ||
      (payload.media != null && (!object(payload.media) || Object.keys(payload.media).some(key => !MEDIA_KEYS.has(key)))) ||
      (payload.extra != null && (!Array.isArray(payload.extra) || payload.extra.length > 64 || !payload.extra.every(supportedExtra)))) {
    throw unsupported();
  }
  const identity = normalizeRequestIdentity(payload);
  if (identity.reason || identity.externalReason || !identity.tmdbId || !identity.mediaType) throw unsupported();
  return identity;
}

/** Pure plan: only the agreed non-null TMDb declarations and receipt marker change. */
export function planRequestIdentityRepair(payload, oldId, candidate, receiptId) {
  const before = assertRepairRequest(payload);
  const newId = candidate?.tmdbId;
  if (before.tmdbId !== oldId || before.mediaType !== candidate?.mediaType ||
      !Number.isInteger(newId) || positiveDatabaseInteger(newId) !== newId || newId === oldId) throw unsupported();
  const next = structuredClone(payload);
  const patches = [];
  const replacement = value => typeof value === 'string' ? String(newId) : newId;
  for (const [container, prefix] of [[next, []], [next.media, ['media']]]) {
    if (!object(container)) continue;
    for (const key of ['tmdb_id', 'tmdbId']) {
      if (Object.hasOwn(container, key) && container[key] != null) {
        container[key] = replacement(container[key]);
        patches.push({ path: [...prefix, key], value: container[key] });
      }
    }
  }
  for (const [index, entry] of (next.extra ?? []).entries()) {
    if (requestExtraIdentityProvider(entry.name) === 'tmdb' && entry.value != null) {
      entry.value = replacement(entry.value);
      patches.push({ path: ['extra', String(index), 'value'], value: entry.value });
    }
  }
  next.identity_repair = receiptId;
  const after = assertRepairRequest(next, true);
  if (after.tmdbId !== newId || after.mediaType !== before.mediaType ||
      after.imdbId !== before.imdbId || after.tvdbId !== before.tvdbId) throw unsupported();
  return { payload: next, patches };
}
