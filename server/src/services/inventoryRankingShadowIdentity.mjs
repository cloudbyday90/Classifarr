/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const INVENTORY_RANKING_SHADOW_VERSION = 'inventory_description_company_shadow_v2';
export const LEGACY_INVENTORY_RANKING_SHADOW_VERSION = 'inventory_description_company_shadow_v1';

export function inventoryRankingItemIdentity(item) {
  return ['movie', 'tv'].includes(item?.media_type) && Number.isInteger(item.tmdb_id) &&
    item.tmdb_id > 0 && item.tmdb_id <= 2147483647 ? `${item.media_type}:${item.tmdb_id}` : null;
}

export function readInventoryRankingIdentity(key, type) {
  if (typeof key !== 'string' || !['movie', 'tv'].includes(type)) return null;
  const id = Number(key.split(':')[1]);
  return inventoryRankingItemIdentity({ media_type: type, tmdb_id: id }) === key ? key : null;
}
