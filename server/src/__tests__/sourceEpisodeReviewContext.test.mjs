/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceEpisodeReviewContext } from '../services/sourceEpisodeReviewContext.mjs';

const review = { sourceSeason: 1, sourceEpisode: 2, tmdbSeriesId: 10, tmdbSeason: 0, tmdbEpisode: 1,
  tmdbEpisodeId: 100, title: 'Catalog title' };

test('projects only requested source labels; never opaque identifiers or unrequested metadata', () => {
  const source = { episodeLabels: [{ season: 1, episode: 2, title: 'Source title', id: 'private-item' },
    { season: 1, episode: 3, title: 'Unrequested title' }] };
  const result = sourceEpisodeReviewContext(source, [review]);
  expect(result).toEqual([{ ...review, sourceTitle: 'Source title' }]);
  expect(result[0]).not.toBe(review);
  expect(JSON.stringify(result)).not.toMatch(/private-item|Unrequested/);
});

test.each([{}, { episodeLabels: [] }])('missing source labels stay explicit without copying the target title', source => {
  expect(sourceEpisodeReviewContext(source, [review])).toEqual([{ ...review, sourceTitle: null }]);
});

test('an empty review has no source context', () => {
  expect(sourceEpisodeReviewContext({ episodeLabels: [{ season: 1, episode: 2, title: 'Private' }] }, [])).toEqual([]);
});
