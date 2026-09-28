/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpGet } from '../../../utils/httpClient.mjs';
import { LIBRARY_CATALOG_REQUEST, readEmbyLibraryCatalog } from './libraryCatalog.mjs';
import { normalizeBaseUrl } from './url.mjs';

/**
 * Jellyfin and legacy Emby use this array contract, without query pagination.
 * @param {string} url
 * @param {string} apiKey
 * @param {{ signal?: AbortSignal | null, onContract?: (value: string) => void, contract?: string }} [options]
 */
export async function readVirtualFolderCatalog(url, apiKey, { signal, onContract, contract = 'jellyfin_virtual_folders' } = {}) {
  onContract?.(contract);
  const response = await httpGet(`${normalizeBaseUrl(url)}/Library/VirtualFolders`, {
    ...LIBRARY_CATALOG_REQUEST, signal,
    headers: { 'X-Emby-Token': apiKey, Accept: 'application/json' },
  });
  return readEmbyLibraryCatalog(response.data);
}
