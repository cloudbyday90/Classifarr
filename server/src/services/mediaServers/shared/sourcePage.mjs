/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SourceEnumerationError } from '../../sourceEnumerationError.mjs';

export const SOURCE_PAGE_LIMIT = 1000;
export const SOURCE_COUNT_LIMIT = 2147483647;
const reject = reason => { throw new SourceEnumerationError(reason); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function count(value, header = false) {
  if (value === undefined) return null;
  if (header && typeof value === 'string' && /^\d{1,10}$/u.test(value)) value = Number(value);
  if (!Number.isInteger(value) || value < 0 || value > SOURCE_COUNT_LIMIT) reject('invalid_page_count');
  return value;
}
function header(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name) ?? undefined;
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
}
function agree(left, right) {
  if (left !== null && right !== null && left !== right) reject('conflicting_page_metadata');
  return left ?? right;
}
export function sourceKey(value) {
  if (Number.isSafeInteger(value) && value > 0) value = String(value);
  if (typeof value !== 'string' || !value.trim() || value.length > 500 || /[\u0000-\u001f\u007f]/u.test(value)) reject('invalid_source_key');
  return value;
}
export function sourcePageRequest({ offset = 0, limit = 100 } = {}) {
  if (count(offset) === null || !Number.isInteger(limit) || limit < 1 || limit > SOURCE_PAGE_LIMIT) reject('invalid_page_request');
  return { offset, limit };
}
function page(items, offset, total, size, key) {
  // Some servers omit empty arrays. Require affirmative emptiness, never a default [].
  if (items === undefined || items === null) {
    if (size === 0 || total === 0) items = [];
    else reject('missing_items');
  }
  if (!Array.isArray(items) || items.length > SOURCE_PAGE_LIMIT || (size !== null && size !== items.length)) reject('invalid_page_items');
  const keys = items.map(item => {
    if (!object(item)) reject('invalid_page_item');
    return sourceKey(item[key]);
  });
  return { items, keys, offset, total };
}
export function readPlexSourcePage(response) {
  const container = response?.data?.MediaContainer;
  if (!object(container)) reject('missing_container');
  const offset = agree(count(container.offset), count(header(response.headers, 'x-plex-container-start'), true));
  const total = agree(count(container.totalSize), count(header(response.headers, 'x-plex-container-total-size'), true));
  return page(container.Metadata, offset, total, count(container.size), 'ratingKey');
}
export function readEmbySourcePage(response) {
  const container = response?.data;
  if (!object(container)) reject('missing_container');
  return page(container.Items, count(container.StartIndex), count(container.TotalRecordCount), null, 'Id');
}
