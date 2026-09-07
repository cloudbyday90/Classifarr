/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { sourceObservationPage } from '../services/mediaSourceObservationContract.mjs';
const invalid = patch => ({ external_id: 'source', title: 'Title', year: 2020, media_type: 'movie',
  provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids', provider_identity_field: 'tvdb_id', ...patch });

test('captures only bounded observation fields, never provider IDs or metadata', () => {
  const input = invalid({ title: 'A\0B', tmdb_id: 123, metadata: { credential: 'private' } });
  const before = structuredClone(input);
  const page = sourceObservationPage(1, 2, [input]);
  expect(page).toEqual({ observed: 1, rejected: 1, uncapturable: 0, resolved: [], unresolved: [{ external_id: 'source',
    title: 'A B', year: 2020, media_type: 'movie', identity_issue: 'conflicting_provider_ids', provider_fields: ['tvdb_id'] }] });
  expect(input).toEqual(before);
  expect(JSON.stringify(page)).not.toContain('private');
});
test.each([null, 1, '', ' ', 'x'.repeat(501), 'a\0b'])('counts unusable source keys without inventing a record: %#', external_id => {
  expect(sourceObservationPage(1, 2, [invalid({ external_id })])).toMatchObject({ rejected: 1, uncapturable: 1, unresolved: [] });
});
test('preserves missing metadata as unknown and recognizes valid source IDs', () => {
  const page = sourceObservationPage(1, 2, [invalid({ title: {}, year: 20000, media_type: 'private' }),
    { external_id: 'valid', media_type: 'movie', tmdb_id: 42 }]);
  expect(page.resolved).toEqual(['valid']);
  expect(page.unresolved[0]).toMatchObject({ title: null, year: null, media_type: null, identity_issue: 'invalid_media_type' });
});
test('bounds pages and rejects invalid capture context', () => {
  expect(() => sourceObservationPage(0, 2, [])).toThrow();
  expect(() => sourceObservationPage(1, 0, [])).toThrow();
  expect(() => sourceObservationPage(1, 2, Array(1001).fill(invalid()))).toThrow();
});
