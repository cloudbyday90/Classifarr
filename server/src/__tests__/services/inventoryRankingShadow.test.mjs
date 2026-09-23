/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getInventoryRankingShadow, rememberInventoryRankingShadow, projectInventoryRankingShadow,
  validInventoryRankingShadow } from '../../services/inventoryRankingShadow.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';

test.each(['movie', 'tv'])('freezes a same-evidence description/company pair for %s without copying provider content', type => {
  const { capture, item, result, evidence } = inventoryRankingShadowFixture(type);
  expect(capture).toMatchObject({ mediaType: type, baselineLibraryId: 1, combinedLibraryId: 2, companyAvailable: true });
  expect(validInventoryRankingShadow(capture)).toBe(true);
  expect(projectInventoryRankingShadow(result, item)).toBe(capture);
  evidence.candidates[0].items[0].similarity = -1;
  expect(capture.candidates[0].descriptionMean).toBe(.85);
  expect(Object.isFrozen(capture.candidates[0])).toBe(true);
  expect(JSON.stringify(capture)).not.toMatch(/Private|overview|tmdb|companyProfile/);
});

test('rejects replayed JSON, mismatched items and metadata-forged captures', () => {
  const { capture, item, result } = inventoryRankingShadowFixture();
  expect(projectInventoryRankingShadow(structuredClone(result), item)).toBeNull();
  expect(projectInventoryRankingShadow(result, { ...item, media_type: 'tv' })).toBeNull();
  expect(projectInventoryRankingShadow(result, { ...item, tmdb_id: 124 })).toBeNull();
  expect(projectInventoryRankingShadow({}, { ...item, classification_details: { inventory_ranking_shadow: capture } })).toBeNull();
  expect(projectInventoryRankingShadow({ signalContext: result }, item)).toBe(capture);
});

test.each([
  ['incomplete', input => { input.evidence.candidates[0].indexed = 1; }],
  ['duplicate', input => { input.evidence.candidates[1] = input.evidence.candidates[0]; }],
  ['mixed snapshots', input => { input.evidence.candidates[0].learnedProfile.snapshotId = 'b'.repeat(64); }],
  ['foreign scope', input => { input.evaluations[0].library_id = 3; }],
  ['no description', input => { delete input.item.overview; }],
  ['unavailable', input => { input.evidence.statusId = 'unavailable'; }],
])('invalid %s evidence clears the previous capture without changing decisions', (_name, mutate) => {
  const input = inventoryRankingShadowFixture();
  mutate(input);
  const before = structuredClone(input.evaluations);
  rememberInventoryRankingShadow(input.evaluations, input.item, input.evidence);
  expect(getInventoryRankingShadow(input.evaluations)).toBeNull();
  expect(input.evaluations).toEqual(before);
});

test('incomplete company coverage is reported as unavailable, never a partial evidence advantage', () => {
  const input = inventoryRankingShadowFixture();
  delete input.evidence.candidates[0].learnedProfile.companyProfile;
  rememberInventoryRankingShadow(input.evaluations, input.item, input.evidence);
  expect(getInventoryRankingShadow(input.evaluations)).toMatchObject({ companyAvailable: false,
    baselineLibraryId: 1, combinedLibraryId: 1, candidates: [{ companyFit: null }, { companyFit: null }] });
});

test('equal rankings abstain instead of favoring library identity or input order', () => {
  const input = inventoryRankingShadowFixture();
  input.evidence.candidates.forEach(candidate => {
    delete candidate.learnedProfile.companyProfile;
    candidate.items.forEach(item => { item.similarity = .8; });
  });
  rememberInventoryRankingShadow(input.evaluations, input.item, input.evidence);
  expect(getInventoryRankingShadow(input.evaluations)).toMatchObject({ baselineLibraryId: null, combinedLibraryId: null });
});

test.each([
  value => { value.version = 'future'; },
  value => { value.capturedAt = 'bad'; },
  value => { value.queryHash = 'bad'; },
  value => { value.candidates[0].libraryId = 0; },
  value => { value.candidates[0].descriptionMean = Infinity; },
  value => { value.candidates[0].metadataFit = 21; },
  value => { value.candidates[0].companyFit = null; },
  value => { value.companyAvailable = false; },
  value => { value.combinedLibraryId = 1; },
  value => { value.candidates = Array(65).fill(value.candidates[0]); },
])('rejects malformed or internally inconsistent stored scores %#', mutate => {
  const value = structuredClone(inventoryRankingShadowFixture().capture);
  mutate(value);
  expect(validInventoryRankingShadow(value)).toBe(false);
});
