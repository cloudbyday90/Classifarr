/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SourceEnumerationError } from './sourceEnumerationError.mjs';
import { SOURCE_PAGE_LIMIT, SOURCE_COUNT_LIMIT, sourceKey } from './mediaServers/shared/sourcePage.mjs';

export const ENUMERATION_LIMITS = Object.freeze({ pages: 10000, items: 1000000 });
/** A receipt of observed enumeration, not a claim of an atomic upstream snapshot. */
export function createMediaSyncCompleteness() {
  const seen = new Set();
  let offset = 0, total = null, pages = 0, complete = false, failed = false;
  const reject = reason => { failed = true; throw new SourceEnumerationError(reason); };
  return {
    get offset() { return offset; },
    get total() { return total; },
    get complete() { return complete; },
    accept(page) {
      if (failed) reject('enumeration_failed');
      if (complete) reject('enumeration_already_complete');
      if (!page || !Array.isArray(page.items) || !Array.isArray(page.keys) || page.keys.length !== page.items.length ||
          page.items.length > SOURCE_PAGE_LIMIT) reject('invalid_page_envelope');
      if (page.offset !== null && page.offset !== offset) reject('unexpected_page_offset');
      if (page.total !== null && (!Number.isInteger(page.total) || page.total < 0 || page.total > SOURCE_COUNT_LIMIT)) reject('invalid_page_total');
      if (pages && page.total !== total) reject('changed_page_total');
      if (++pages > ENUMERATION_LIMITS.pages || offset + page.items.length > ENUMERATION_LIMITS.items) reject('enumeration_limit');
      total = page.total;
      let keys;
      try { keys = page.keys.map(sourceKey); }
      catch (error) { failed = true; throw error; }
      const distinct = new Set(keys);
      if (distinct.size !== keys.length || keys.some(key => seen.has(key))) reject('repeated_source_key');
      if (total !== null && offset + keys.length > total) reject('page_exceeds_total');
      if (!keys.length && (total === null || offset !== total)) reject(total === null ? 'unknown_source_total' : 'premature_empty_page');
      for (const key of keys) seen.add(key);
      offset += keys.length;
      complete = total !== null && offset === total;
      return complete;
    },
    receipt() {
      if (failed || !complete) throw new SourceEnumerationError('completion_unproven');
      return Object.freeze({ version: 1, pages, uniqueItems: seen.size, reportedTotal: total });
    },
  };
}
