/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { posix, win32 } from 'node:path';

export function normalizeArrId(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function normalizedPath(value) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^[\\/]{2}[?.][\\/]/.test(value)) return null;
  const windows = /^[a-z]:[\\/]/i.test(value) || /^[\\/]{2}[^\\/]/.test(value);
  const path = windows ? win32 : posix;
  if (!path.isAbsolute(value) || value.split(windows ? /[\\/]/ : /\//).some(part => part === '.' || part === '..')) return null;
  // A POSIX backslash is ambiguous with Windows syntax; never guess an alias.
  if (!windows && value.includes('\\')) return null;
  const normalized = path.normalize(value).replaceAll('\\', '/').replace(/\/+$/, '');
  return { windows, value: normalized || '/' };
}

export function isValidArrExpectation({ identityKey, identity, rootFolderPath }) {
  return ['tmdbId', 'tvdbId'].includes(identityKey) && normalizeArrId(identity) !== null && normalizedPath(rootFolderPath) !== null;
}

export function verifyArrResource(resource, expected) {
  if (!isValidArrExpectation(expected) || !normalizeArrId(resource?.id)
    || normalizeArrId(resource?.[expected.identityKey]) !== normalizeArrId(expected.identity)) return false;
  const root = normalizedPath(expected.rootFolderPath), actual = normalizedPath(resource.path);
  if (!actual || actual.windows !== root.windows || actual.value === root.value
    || !actual.value.startsWith(root.value === '/' ? '/' : `${root.value}/`)) return false;
  if (resource.rootFolderPath !== undefined && resource.rootFolderPath !== null && resource.rootFolderPath !== '') {
    const reported = normalizedPath(resource.rootFolderPath);
    if (!reported || reported.windows !== root.windows || reported.value !== root.value) return false;
  }
  return true;
}

/** Providers return arrays, even for a filtered read. Malformed is not absent. */
export function selectArrResource(items, identityKey, identity) {
  const id = normalizeArrId(identity);
  if (!id || !['tmdbId', 'tvdbId'].includes(identityKey) || !Array.isArray(items)
    || items.some(item => !normalizeArrId(item?.id) || !normalizeArrId(item?.[identityKey]))) {
    throw new Error('Invalid provider identity response');
  }
  const matches = items.filter(item => normalizeArrId(item[identityKey]) === id);
  if (matches.length > 1) throw new Error('Ambiguous provider identity response');
  return matches[0] ?? null;
}
