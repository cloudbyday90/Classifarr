/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { createCandidateLocalIndex, retrieveCandidateLocalEvidence } from '../../services/inventoryCandidateLocalIndex.mjs';
import { normalizeDescriptionVector } from '../../services/inventoryDescriptionSimilarity.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
function fixture() {
  const documents = [], vectors = new Map(), candidateMetadata = new Map(), libraries = [];
  const model = { libraries: new Map() }, held = new Set([hash('query')]);
  for (const id of [1, 2, 3]) {
    const type = id === 3 ? 'tv' : 'movie', counts = id === 1 ? [3, 4] : [3], groups = [];
    libraries.push({ id, media_type: type, name: 'PRIVATE name' });
    for (const [group, count] of counts.entries()) {
      const hashes = [];
      for (let n = 0; n < count; n++) {
        const key = `${id}:${group}:${n}`, h = hash(key);
        documents.push({ key, hash: h, type, libraryIds: [id] }); hashes.push(h);
        vectors.set(h, group ? [0, 0, 1] : id === 1 ? [1, 0, 0] : [0, 1, 0]);
        candidateMetadata.set(key, { genres: ['PRIVATE genre'], studio: '' });
      }
      groups.push(hashes);
    }
    const unassigned = hash(`unassigned:${id}`);
    documents.push({ key: unassigned, hash: unassigned, type, libraryIds: [id] }); vectors.set(unassigned, [-1, 0, 0]);
    const selected = { converged: true, groups: groups.map(hashes => ({ support: hashes.length,
      representatives: hashes.slice(0, 3), centroid: vectors.get(hashes[0]) })) };
    model.libraries.set(id, { mediaType: type, coverage: { status: 'complete' }, selectedStart: 0,
      starts: [selected, structuredClone(selected), structuredClone(selected)], membership: { groups, unassigned: [unassigned] } });
  }
  const queryHash = [...held][0];
  documents.push({ key: 'query', hash: queryHash, type: 'movie', libraryIds: [1] }); vectors.set(queryHash, [1, 0, 0]);
  const snapshot = { libraries, candidateMetadata, corpus: { documents, texts: new Map([...vectors.keys()].map(h => [h, 'PRIVATE description'])) }, vectors };
  return { snapshot, model, held };
}
const build = (f = fixture(), signal) => createCandidateLocalIndex(f.snapshot, f.model, f.held, 3, signal);
const retrieve = (index, vector = [1, 0, 0], type = 'movie', signal) =>
  retrieveCandidateLocalEvidence(index, { type, hash: hash('query'), vector }, signal);

test('excludes all held copies, keeps full media scope and retrieves distinct ordered items without mutation', async () => {
  const f = fixture(), before = structuredClone(f), index = await build(f);
  const evidence = await retrieve(index);
  expect(evidence).toMatchObject({ complete: true, slice: 'smallest_supported_group', sharedMaximum: -1 });
  expect(evidence.candidates.map(row => row.id)).toEqual([1, 2]);
  expect(evidence.candidates[0].items.map(row => row.hash)).toEqual([...f.model.libraries.get(1).membership.groups[0]].sort());
  expect(index.items.some(item => f.held.has(item.hash))).toBe(false);
  expect(JSON.stringify(index.items)).not.toMatch(/PRIVATE name|PRIVATE description|libraryIds/);
  expect(f).toEqual(before);
  expect((await retrieve(index, [0, 0, 1])).slice).toBe('other_supported_group');
  expect((await retrieve(index, [-1, 0, 0])).slice).toBe('unassigned');
  expect((await retrieve(index, [1, 0, 0], 'tv')).complete).toBe(false);
  expect((await retrieve(index, [1, 0, 0], 'unknown')).slice).toBe('unavailable');
});

test('shared copies cannot vote and conflicting metadata stays unavailable', async () => {
  const f = fixture(), sharedHash = hash('shared');
  for (const id of [1, 2]) f.snapshot.corpus.documents.push({ key: `shared:${id}`, hash: sharedHash, type: 'movie', libraryIds: [id] });
  f.snapshot.corpus.texts.set(sharedHash, 'private shared'); f.snapshot.vectors.set(sharedHash, [1, 0, 0]);
  const original = f.snapshot.corpus.documents[0];
  f.snapshot.corpus.documents.push({ ...original, key: 'conflicting-copy' });
  f.snapshot.candidateMetadata.set('conflicting-copy', { genres: ['different'] });
  const index = await build(f), evidence = await retrieve(index);
  expect(evidence.sharedMaximum).toBe(1);
  expect(evidence.candidates.every(row => row.items.every(item => item.hash !== sharedHash))).toBe(true);
  expect(index.items.find(item => item.hash === original.hash).metadata).toBeNull();
});

test('nearest retrieval matches a brute-force oracle across all examples, including unassigned', async () => {
  const index = await build();
  for (const vector of [[1, 1, 1], [-1, 2, 0], [0.2, -0.3, 0.7]]) {
    const query = normalizeDescriptionVector(vector, 3), evidence = await retrieve(index, vector);
    for (const candidate of evidence.candidates) {
      const oracle = index.items.filter(item => item.type === 'movie' && item.id === candidate.id).map(item => ({ hash: item.hash,
        score: item.vector.reduce((total, value, dimension) => total + value * query[dimension], 0) }))
        .sort((a, b) => b.score - a.score || (a.hash < b.hash ? -1 : 1)).slice(0, 3);
      expect(candidate.items.map(item => item.hash)).toEqual(oracle.map(item => item.hash));
    }
  }
});

test('unavailable profiles remain candidates, incomplete vectors and corrupt membership fail closed', async () => {
  for (const mutate of [profile => { profile.coverage.status = 'waiting'; }, profile => { profile.starts[1].converged = false; },
    profile => { profile.membership.unassigned.push(...profile.membership.groups.flat()); profile.membership.groups = []; profile.starts.forEach(start => { start.groups = []; }); }]) {
    const f = fixture(); mutate(f.model.libraries.get(2));
    const evidence = await retrieve(await build(f)); expect(evidence.complete).toBe(false); expect(evidence.candidates).toHaveLength(2);
  }
  const missing = fixture(); missing.snapshot.vectors.delete(missing.snapshot.corpus.documents.at(-2).hash);
  await expect(build(missing)).rejects.toThrow('complete_cache_required');
  const corrupt = fixture(); corrupt.model.libraries.get(1).membership.groups[0][0] = hash('unknown');
  await expect(build(corrupt)).rejects.toThrow();
  const scope = fixture(); scope.model.libraries.delete(2); await expect(build(scope)).rejects.toThrow('scope_changed');
  await expect(build({ ...fixture(), held: new Set() })).rejects.toThrow('holdout_required');
  const index = await build();
  await expect(retrieveCandidateLocalEvidence(index, { type: 'movie', hash: hash('not-held'), vector: [1, 0, 0] })).rejects.toThrow('holdout_required');
});

test('cancellation interrupts both indexing and retrieval', async () => {
  const index = await build(), controller = new AbortController(); controller.abort();
  await expect(build(fixture(), controller.signal)).rejects.toThrow();
  await expect(retrieve(index, [1, 0, 0], 'movie', controller.signal)).rejects.toThrow();
});
