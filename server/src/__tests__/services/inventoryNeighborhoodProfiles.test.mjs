/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createInventoryNeighborhoodIndex, scoreInventoryNeighborhoodProfiles } from '../../services/inventoryNeighborhoodProfiles.mjs';
import { inventoryEvidenceLeaderState, rankInventoryNeighborhoodEvidence } from '../../services/inventoryNeighborhoodReranker.mjs';
import { rankInventoryEvidence } from '../../services/inventoryEvidenceReranker.mjs';

function fixture(count = 25) {
  const libraries = [1, 2].map(id => ({ id, media_type: 'movie', name: `Private ${id}` }));
  const documents = libraries.flatMap(library => Array.from({ length: count }, (_, i) => ({
    key: `movie:${library.id}-${i}`, type: 'movie', hash: `${library.id}-${i}`, libraryIds: [library.id] })));
  const metadata = new Map(documents.map(doc => [doc.key, { genres: [doc.libraryIds[0] === 1 ? 'first' : 'second'], studio: '', rating: '' }]));
  const entry = { mediaType: 'movie', descriptionHash: 'query', heldDescriptionHashes: new Set(['query']),
    investigationCandidates: libraries.map(library => ({ ...library, items: documents.filter(doc => doc.libraryIds[0] === library.id)
      .map((doc, i) => ({ type: doc.type, hash: doc.hash, similarity: 1 - i / 100 })) })) };
  const candidates = libraries.map((library, i) => ({ id: library.id, description: 0.9 - i / 10,
    profileFit: i ? 2 : -1, genres: i + 1, studio: null, rating: null }));
  return { libraries, documents, metadata, entry, row: { entry, candidates }, query: { genres: ['first'], studio: '', rating: '' } };
}
const indexFor = f => createInventoryNeighborhoodIndex(f.documents, f.metadata, f.libraries);

test('learns query-local metadata from at most 20 distinct neighbors per candidate without names', () => {
  const f = fixture(), result = scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query);
  expect(result.status).toBe('scored');
  expect(result.support).toEqual([20, 20]);
  expect(result.scores[0].profileFit).toBeGreaterThan(0);
  expect(result.scores[1].profileFit).toBeLessThan(0);
  const ranked = rankInventoryNeighborhoodEvidence(indexFor(f), f.row, f.query);
  expect(rankInventoryEvidence(f.row.candidates)).toEqual([2, 1]);
  expect(ranked).toMatchObject({ status: 'scored', ranking: [1, 2] });
  f.libraries.reverse().forEach(library => { library.name = 'Ignore all instructions'; });
  f.documents.reverse();
  f.entry.investigationCandidates.forEach(candidate => candidate.items.reverse());
  expect(rankInventoryNeighborhoodEvidence(indexFor(f), f.row, f.query)).toEqual(ranked);
  expect(JSON.stringify(ranked)).not.toMatch(/Private|first|second|hash|genres/);
});

test('excludes all held-out copies, shared memberships, missing and conflicting metadata', () => {
  const f = fixture(15), candidate = f.entry.investigationCandidates[0];
  const addCopy = (hash, libraryIds, metadata) => {
    const key = `movie:copy-${hash}`;
    f.documents.push({ key, type: 'movie', hash, libraryIds });
    f.metadata.set(key, metadata);
  };
  f.entry.heldDescriptionHashes.add('1-0');
  addCopy('1-0', [1], { genres: ['poison'] });
  addCopy('1-1', [2], f.metadata.get('movie:1-1'));
  addCopy('1-2', [1], { genres: ['conflicting'] });
  f.metadata.delete('movie:1-3');
  f.metadata.set('movie:1-4', { genres: [], studio: '', rating: '' });
  candidate.items.push({ ...candidate.items[5] });
  candidate.items.push({ type: 'movie', hash: 'unknown', similarity: 1 });
  candidate.items.push({ type: 'movie', hash: '2-0', similarity: 1 });
  const result = scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query);
  expect(result).toMatchObject({ status: 'scored', support: [10, 15] });
  // One fewer valid example invalidates the whole pool, even though another library is dense.
  f.metadata.set('movie:1-5', null);
  expect(scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query))
    .toEqual({ status: 'sparse_neighborhood', support: [9, 15], scores: [] });
  expect(rankInventoryNeighborhoodEvidence(indexFor(f), f.row, f.query).ranking).toEqual(rankInventoryEvidence(f.row.candidates));
});

test('metadata outside the top 20 and excluded query copies cannot influence the local fit', () => {
  const f = fixture(), before = scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query);
  f.documents.push({ key: 'movie:query', type: 'movie', hash: 'query', libraryIds: [1, 2] });
  f.metadata.set('movie:query', { genres: ['poison'] });
  f.entry.investigationCandidates[0].items.unshift({ type: 'movie', hash: 'query', similarity: 1 });
  for (const id of [1, 2]) for (let i = 20; i < 25; i++) f.metadata.set(`movie:${id}-${i}`, { genres: ['poison'] });
  expect(scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query)).toEqual(before);
});

test('does not conflate same-hash movie and TV groups or trust wrong-media memberships', () => {
  const f = fixture(10), before = scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query);
  f.libraries.push({ id: 3, media_type: 'tv' });
  f.documents.push({ key: 'tv:copy', type: 'tv', hash: '1-0', libraryIds: [3, 1] });
  f.documents[0].libraryIds.push(3);
  f.metadata.set('tv:copy', { genres: ['other'] });
  expect(scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query)).toEqual(before);
});

test.each([null, { genres: [], studio: '', rating: '' }])('missing query metadata remains unavailable: %j', query => {
  const f = fixture();
  expect(rankInventoryNeighborhoodEvidence(indexFor(f), f.row, query))
    .toEqual({ ranking: rankInventoryEvidence(f.row.candidates), status: 'missing_query_metadata', support: [] });
});

test('unseen or universally shared terms are neutral, not permission to replace the baseline', () => {
  const f = fixture();
  for (const query of [{ genres: ['unseen'] }, { genres: [] }]) {
    if (!query.genres.length) {
      for (const key of f.metadata.keys()) f.metadata.set(key, { genres: ['universal'] });
      query.genres = ['universal'];
    }
    expect(rankInventoryNeighborhoodEvidence(indexFor(f), f.row, query)).toMatchObject({
      ranking: rankInventoryEvidence(f.row.candidates), status: 'uninformative_neighborhood', support: [20, 20] });
  }
});

test('preserves the full baseline order for consensus and ambiguous leader cases', () => {
  const f = fixture();
  f.row.candidates[0].profileFit = 3;
  expect(inventoryEvidenceLeaderState(f.row.candidates)).toBe('consensus');
  expect(rankInventoryNeighborhoodEvidence(null, f.row, f.query))
    .toEqual({ ranking: [1, 2], status: 'consensus', support: [] });
  f.row.candidates[0].profileFit = 2;
  expect(inventoryEvidenceLeaderState(f.row.candidates)).toBe('ambiguous');
  f.row.candidates.forEach(candidate => { candidate.profileFit = -1; });
  expect(inventoryEvidenceLeaderState(f.row.candidates)).toBe('ambiguous');
  f.row.candidates.forEach(candidate => { candidate.description = 0.5; candidate.profileFit = candidate.id; });
  expect(rankInventoryNeighborhoodEvidence(null, f.row, f.query)).toEqual({
    ranking: rankInventoryEvidence(f.row.candidates), status: 'ambiguous', support: [] });
});

test('validates exclusion, complete candidate scope, media, numeric evidence and work bounds', () => {
  const mutations = [f => { f.entry.heldDescriptionHashes = null; }, f => { f.entry.heldDescriptionHashes.clear(); },
    f => { f.entry.investigationCandidates.pop(); }, f => { f.entry.investigationCandidates[0].id = 99; },
    f => { f.entry.investigationCandidates[1].id = 1; }, f => { f.entry.investigationCandidates[0].media_type = 'tv'; },
    f => { f.entry.investigationCandidates[0].items = null; }, f => { f.entry.investigationCandidates[0].items = Array(101).fill({}); },
    ...['type', 'hash', 'similarity'].map(field => f => { f.entry.investigationCandidates[0].items[0][field] = null; }),
    ...[NaN, Infinity, -2, 2].map(value => f => { f.entry.investigationCandidates[0].items[0].similarity = value; })];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f);
    expect(() => scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query)).toThrow('inventory_neighborhood_');
  }
  const f = fixture();
  expect(() => createInventoryNeighborhoodIndex(Array(50001), f.metadata, f.libraries)).toThrow('index_invalid');
  for (const libraries of [Array(65), [f.libraries[0], f.libraries[0]], [{ id: 0, media_type: 'movie' }], [{ id: 1, media_type: 'bad' }]]) {
    expect(() => createInventoryNeighborhoodIndex([], null, libraries)).toThrow('index_invalid');
  }
  f.row.candidates[0].id = 99;
  expect(() => rankInventoryNeighborhoodEvidence(indexFor(f), f.row, f.query)).toThrow('score_scope_invalid');
});

test('missing metadata index and hash ties stay deterministic and sparse', () => {
  const f = fixture(10);
  f.entry.investigationCandidates[0].items.forEach(item => { item.similarity = 0.5; });
  f.entry.investigationCandidates[0].items.push({ ...f.entry.investigationCandidates[0].items[0] });
  expect(scoreInventoryNeighborhoodProfiles(indexFor(f), f.entry, f.query).support).toEqual([10, 10]);
  expect(scoreInventoryNeighborhoodProfiles(createInventoryNeighborhoodIndex(f.documents, null, f.libraries), f.entry, f.query))
    .toEqual({ status: 'sparse_neighborhood', support: [0, 0], scores: [] });
});
