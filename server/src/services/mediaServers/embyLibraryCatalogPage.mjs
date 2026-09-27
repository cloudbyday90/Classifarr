/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { LIBRARY_CATALOG_LIMIT, invalidLibraryCatalog, readEmbyLibraryCatalog } from './shared/libraryCatalog.mjs';

/** Emby query envelopes are deliberately not accepted by the Jellyfin array parser. */
export function readEmbyLibraryCatalogPage(data, offset, limit) {
  if (!data || Array.isArray(data) || !Array.isArray(data.Items) ||
      !Number.isSafeInteger(data.TotalRecordCount) || data.TotalRecordCount < 0 ||
      data.TotalRecordCount > LIBRARY_CATALOG_LIMIT || data.Items.length > limit ||
      offset + data.Items.length > data.TotalRecordCount ||
      (data.StartIndex !== undefined && data.StartIndex !== offset) ||
      (data.Items.length === 0 && offset < data.TotalRecordCount)) throw invalidLibraryCatalog();

  const items = readEmbyLibraryCatalog(data.Items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        (item.ItemId != null && item.Id != null && item.ItemId !== item.Id)) throw invalidLibraryCatalog();
    // Never repair a malformed supplied ItemId by silently selecting another identity.
    return { ItemId: item.ItemId ?? item.Id, Name: item.Name, CollectionType: item.CollectionType };
  }));
  return { items, total: data.TotalRecordCount };
}
