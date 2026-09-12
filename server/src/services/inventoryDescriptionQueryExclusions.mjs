/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';

/** Hold out every current/stored synopsis copy, even when stored synopses conflict. */
export function inventoryDescriptionQueryExcludedHashes(rows, request) {
  const held = new Set([request.hash]);
  for (const row of rows) {
    if (`${row.media_type}:${row.tmdb_id}` !== request.key) continue;
    const text = projectInventoryDescription({ metadata: { overview: row.overview } })?.text;
    if (text) held.add(createHash('sha256').update(text).digest('hex'));
  }
  return held;
}
