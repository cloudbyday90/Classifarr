/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildClassificationDestinationDecision, captureCorrectionDecisionContext,
  readClassificationDestinationDecision, readCorrectionDecisionContext } from '../../services/classificationDestinationDecision.mjs';

const metadata = { media_type: 'movie', tmdb_id: 42 };
const build = (overrides = {}) => buildClassificationDestinationDecision({ metadata, method: 'ai_analysis', status: 'completed', libraryId: 2, ...overrides });
const row = (capture = build()) => ({ id: 8, ...metadata, method: capture.method, metadata: { classification_details: { destination_decision: capture } } });

test('copies only typed identity, method and the saved state, without content or aliases', () => {
  expect(build()).toEqual({ version: 'classification.destination_decision.v1', mediaType: 'movie', tmdbId: 42,
    method: 'ai_analysis', status: 'completed', libraryId: 2 });
  expect(build({ metadata: { media_type: 'tv', tmdb_id: '42', title: 'PRIVATE' }, libraryId: '3' }))
    .toMatchObject({ mediaType: 'tv', tmdbId: 42, libraryId: 3 });
  expect(build({ metadata: { media_type: 'movie' }, method: 'source_library' })).toMatchObject({ tmdbId: null });
});

test.each(['awaiting_decision', 'pending_retry'])('%s must not include a final destination', status => {
  expect(build({ status, libraryId: null })).toMatchObject({ status, libraryId: null });
  expect(build({ status })).toBeNull();
});

test.each([{ metadata: { ...metadata, tmdb_id: true } }, { metadata: { ...metadata, media_type: 'music' } },
  { method: 'unknown' }, { status: 'corrected' }, { libraryId: null }, { libraryId: -1 }])('invalid input stays unknown: %j', change => {
  expect(build(change)).toBeNull();
});

test.each([null, [], {}, { ...build(), title: 'PRIVATE' }, { ...build(), version: 'future' },
  { ...build(), tmdbId: '42' }, { ...build(), libraryId: true }])('rejects malformed stored projection %j', value => {
  expect(readClassificationDestinationDecision(value)).toBeNull();
});

test('locks capture to the original typed identity, never to updated library or status', () => {
  const original = row();
  expect(captureCorrectionDecisionContext({ ...original, library_id: 999, status: 'corrected' }))
    .toEqual({ classificationId: 8, capture: build() });
  expect(captureCorrectionDecisionContext({ ...original, metadata: JSON.stringify(original.metadata) }))
    .toEqual({ classificationId: 8, capture: build() });
  for (const change of [{ tmdb_id: 43 }, { media_type: 'tv' }, { method: 'source_library' }, { tmdb_id: null }, { id: 0 }, { metadata: '{}' }]) {
    expect(captureCorrectionDecisionContext({ ...original, ...change })).toBeNull();
  }
  const source = row(build({ metadata: { media_type: 'movie', tmdb_id: null }, method: 'source_library' }));
  expect(captureCorrectionDecisionContext({ ...source, tmdb_id: 'bad' })).toBeNull();
  expect(readCorrectionDecisionContext({ classificationId: 8, capture: build(), token: 'SECRET' })).toBeNull();
  expect(readCorrectionDecisionContext({ classificationId: 8, capture: {} })).toBeNull();
});
