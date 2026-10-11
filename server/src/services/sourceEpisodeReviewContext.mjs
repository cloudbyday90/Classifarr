/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Display-only provider text. Never an identity key, URL or matching signal. */
export function sourceEpisodeTitle(value) {
  if (typeof value !== 'string') return null;
  return value.slice(0, 500).replace(/[\p{Cc}\p{Cf}]/gu, '').trim() || null;
}

/** Project only declared review rows; do not expose opaque source item IDs. */
export function sourceEpisodeReviewContext(source, episodeReviews) {
  const labels = new Map((source.episodeLabels ?? []).map(row => [`${row.season}:${row.episode}`, row.title]));
  return episodeReviews.map(row => ({ ...row,
    sourceTitle: sourceEpisodeTitle(labels.get(`${row.sourceSeason}:${row.sourceEpisode}`)) }));
}
