/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpGet } from '../../utils/httpClient.mjs';
import { createRequestCancellation } from '../../utils/requestCancellation.mjs';
import { LIBRARY_CATALOG_REQUEST, invalidLibraryCatalog, validateLibraryCatalog } from './shared/libraryCatalog.mjs';
import { readVirtualFolderCatalog } from './shared/virtualFolderCatalog.mjs';
import { normalizeBaseUrl } from './shared/url.mjs';
import { readEmbyLibraryCatalogPage } from './embyLibraryCatalogPage.mjs';

export const EMBY_CATALOG_PAGE_SIZE = 100;
export const EMBY_CATALOG_MAX_PAGES = 20;
export const EMBY_CATALOG_DEADLINE_MS = 30000;

/**
 * Read all pages before exposing any catalog to discovery or archive review.
 * @param {string} url
 * @param {string} apiKey
 * @param {{ signal?: AbortSignal | null, onContract?: (value: string) => void }} [options]
 */
export async function readEmbyLibraryCatalog(url, apiKey, { signal, onContract } = {}) {
  onContract?.('emby_query');
  const cancellation = createRequestCancellation(EMBY_CATALOG_DEADLINE_MS, signal);
  const catalog = [], identities = new Set();
  let total;
  for (let page = 0; page < EMBY_CATALOG_MAX_PAGES; page++) {
    cancellation.throwIfAborted();
    let response;
    try {
      response = await httpGet(`${normalizeBaseUrl(url)}/Library/VirtualFolders/Query`, {
        ...LIBRARY_CATALOG_REQUEST, signal: cancellation.signal,
        headers: { 'X-Emby-Token': apiKey, Accept: 'application/json' },
        params: { StartIndex: catalog.length, Limit: EMBY_CATALOG_PAGE_SIZE },
      });
    } catch (error) {
      cancellation.throwIfAborted();
      // Only endpoint negotiation on the first request, never a failed later page.
      if (page !== 0 || ![404, 405].includes(error?.response?.status)) throw error;
      const legacy = await readVirtualFolderCatalog(url, apiKey, { signal: cancellation.signal, onContract, contract: 'emby_legacy' });
      cancellation.throwIfAborted();
      return legacy;
    }
    cancellation.throwIfAborted();
    const result = readEmbyLibraryCatalogPage(response.data, catalog.length, EMBY_CATALOG_PAGE_SIZE);
    if (total !== undefined && total !== result.total) throw invalidLibraryCatalog();
    total = result.total;
    for (const item of result.items) {
      if (identities.has(item.external_id)) throw invalidLibraryCatalog();
      identities.add(item.external_id);
      catalog.push(item);
    }
    if (catalog.length === total) return validateLibraryCatalog(catalog);
  }
  throw invalidLibraryCatalog();
}
