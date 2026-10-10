/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { copyCrossReferenceEvidence } from './sourceIdentityCrossReferenceEvidence.mjs';

export const SOURCE_LAYOUT_LIMITS = Object.freeze({ pageSize: 100, maximumPages: 20, maximumEpisodes: 2000 });
const index = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;
const key = value => typeof value === 'string' && value.length > 0 && value.length <= 500 &&
  !/[\p{Cc}\p{Cf}]/u.test(value);
const reject = () => { throw new Error('source_layout_invalid'); };

/** Transient, adapter-neutral snapshot. No catalog match or possession claim. */
export async function captureSourceLayout({ readIdentity, readPage, signal }) {
  signal?.throwIfAborted();
  const identity = copyCrossReferenceEvidence(await readIdentity());
  if (!identity) reject();
  const episodes = [], ids = new Set(), positions = new Set();
  if (identity.mediaType === 'tv') {
    let total;
    for (let pageNumber = 0; pageNumber < SOURCE_LAYOUT_LIMITS.maximumPages; pageNumber++) {
      signal?.throwIfAborted();
      const offset = episodes.length;
      const page = await readPage({ offset, limit: SOURCE_LAYOUT_LIMITS.pageSize });
      signal?.throwIfAborted();
      if (!page || page.offset !== offset || !Number.isSafeInteger(page.total) || page.total < 0 ||
          page.total > SOURCE_LAYOUT_LIMITS.maximumEpisodes || !Array.isArray(page.items) ||
          page.items.length > SOURCE_LAYOUT_LIMITS.pageSize ||
          (total !== undefined && total !== page.total)) reject();
      total = page.total;
      if (offset + page.items.length > total || (!page.items.length && offset !== total)) reject();
      for (const item of page.items) {
        if (!key(item?.id) || !index(item.season) || !index(item.episode) ||
            (item.end !== undefined && item.end !== null && item.end !== item.episode) || ids.has(item.id)) reject();
        const position = `${item.season}:${item.episode}`;
        if (positions.has(position)) reject();
        ids.add(item.id);
        positions.add(position);
        episodes.push({ id: item.id, season: item.season, episode: item.episode });
      }
      if (episodes.length === total) break;
    }
    if (episodes.length !== total) reject();
  }
  signal?.throwIfAborted();
  episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
  const seasons = new Map();
  for (const episode of episodes) {
    const entries = seasons.get(episode.season) ?? [];
    entries.push(episode.episode);
    seasons.set(episode.season, entries);
  }
  const digest = createHash('sha256').update(JSON.stringify({ identity, episodes })).digest('hex');
  return { identity, digest, episodeCount: episodes.length,
    seasons: [...seasons].map(([number, numbers]) => ({ number, episodes: numbers })) };
}
