/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { inventoryDescriptionQueryAliases } from './inventorySourceDescriptionIdentity.mjs';

/** Hold out every current/stored synopsis copy, even when stored synopses conflict. */
export function inventoryDescriptionQueryExcludedHashes(rows, request) {
  const held = new Set([request.hash]);
  const aliases = rows.map(row => inventoryDescriptionQueryAliases(row));
  const known = [request.identityAliases, ...aliases.filter((_, index) =>
    `${rows[index].media_type}:${rows[index].tmdb_id}` === request.key)].filter(Boolean);
  const imdb = new Set(known.map(value => value.imdbId).filter(Boolean));
  const tvdb = new Set(known.map(value => value.tvdbId).filter(Boolean));
  const sources = new Set(known.map(value => value.sourceKey).filter(Boolean));
  let index = 0;
  for (const row of rows) {
    const alias = aliases[index++];
    if (row.media_type !== request.mediaType && request.mediaType != null) continue;
    if (`${row.media_type}:${row.tmdb_id}` !== request.key && !imdb.has(alias.imdbId) &&
        !tvdb.has(alias.tvdbId) && !sources.has(alias.sourceKey)) continue;
    const text = projectInventoryDescription({ metadata: { overview: row.overview } })?.text;
    if (text) held.add(createHash('sha256').update(text).digest('hex'));
  }
  return held;
}
