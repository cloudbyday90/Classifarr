/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ServiceUnavailableError } from '../../../utils/appError.mjs';

export const LIBRARY_CATALOG_LIMIT = 1000;
export const LIBRARY_CATALOG_REQUEST = Object.freeze({ timeout: 10000, maxResponseBytes: 4 * 1024 * 1024 });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const reject = () => { throw new ServiceUnavailableError('The media server returned an invalid or incomplete library catalog. Existing libraries were preserved.', { code: 'library_catalog_invalid' }); };
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) reject();
  return value;
}

/** Validate all entries, including unsupported types, before exposing any result. */
export function validateLibraryCatalog(entries) {
  if (!Array.isArray(entries) || entries.length > LIBRARY_CATALOG_LIMIT) reject();
  const seen = new Set();
  return entries.map(entry => {
    if (!object(entry)) reject();
    const externalId = text(entry.external_id, 100);
    const name = text(entry.name, 255);
    if (seen.has(externalId) || ![null, 'movie', 'tv'].includes(entry.media_type)) reject();
    seen.add(externalId);
    return { external_id: externalId, name, media_type: entry.media_type };
  });
}

export function readPlexLibraryCatalog(data) {
  const container = data?.MediaContainer;
  if (!object(container)) reject();
  const entries = container.Directory ?? (container.size === 0 ? [] : undefined);
  if (!Array.isArray(entries) || entries.length > LIBRARY_CATALOG_LIMIT) reject();
  for (const count of [container.size, container.totalSize]) {
    if (count !== undefined && (!Number.isInteger(count) || count !== entries.length)) reject();
  }
  if (container.offset !== undefined && container.offset !== 0) reject();
  return validateLibraryCatalog(entries.map(entry => {
    if (!object(entry)) reject();
    const type = text(entry.type, 100);
    return { external_id: entry.key, name: entry.title,
      media_type: type === 'movie' ? 'movie' : type === 'show' ? 'tv' : null };
  }));
}

export function readEmbyLibraryCatalog(data) {
  if (!Array.isArray(data) || data.length > LIBRARY_CATALOG_LIMIT) reject();
  return validateLibraryCatalog(data.map(entry => {
    if (!object(entry)) reject();
    // A missing collection type is a mixed/unspecified folder, never a movie library.
    if (entry.CollectionType != null && entry.CollectionType !== '') text(entry.CollectionType, 100);
    return { external_id: entry.ItemId, name: entry.Name,
      media_type: entry.CollectionType === 'movies' ? 'movie' : entry.CollectionType === 'tvshows' ? 'tv' : null };
  }));
}
