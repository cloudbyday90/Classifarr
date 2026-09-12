/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import { runContentFirstInventoryComparison } from '../../services/inventoryContentFirstComparison.mjs';
import { describeInventorySnapshotDigests } from '../../services/inventoryDescriptionSnapshotDigests.mjs';

const seed = 'content-first-comparison-2026';
const hash = text => createHash('sha256').update(text).digest('hex');
function fixture(count = 6) {
  const texts = new Map();
  const candidates = [1, 2, 3].map(id => ({ id, name: `Private library ${id}`, media_type: 'movie',
    items: Array.from({ length: 4 }, (_, index) => {
      const text = `Private example ${id}:${index}`, digest = hash(text);
      texts.set(digest, text);
      return { hash: digest, libraryIds: new Set([id]) };
    }) }));
  const cases = Array.from({ length: count }, (_, index) => {
    const overview = `Private query ${index}`, descriptionHash = hash(overview);
    texts.set(descriptionHash, overview);
    return { overview, descriptionHash, heldDescriptionHashes: new Set([descriptionHash]), foldIndex: index % 5,
      mediaType: 'movie', observedLibraryIds: [1], candidates };
  });
  return { cases, texts, evaluation: { folds: 5 }, libraryStrata: [1, 2, 3, 4].map(id => ({ id, stratum: id })) };
}
const options = count => ({ seed, size: count, folds: 5, generateCases: count });

test('all cases receive paired, order-balanced treatments with identical evidence and separate gains/losses', async () => {
  const prepared = fixture(), onProgress = jest.fn(), packets = [];
  const named = [2, 1, 2, 0, 1, 2], anonymous = [1, 2, 3, 1, 1, 0];
  const client = { generate: jest.fn(async ({ prompt }) => {
    const packet = JSON.parse(prompt.split('\n')[3]); packets.push(packet);
    const index = Number(packet.query.overview.split(' ').at(-1));
    const isAnonymous = packet.libraries[0].name === 'Library 1';
    return { response: JSON.stringify({ candidate: (isAnonymous ? anonymous : named)[index] }), latencyMs: 2, promptTokens: 100 };
  }) };
  const report = await runContentFirstInventoryComparison(prepared, options(6), { client, onProgress });
  expect(report).toMatchObject({ status: 'complete', calls: 12, maximumCalls: 12, accuracy: null,
    paired: { requested: 6, validPairs: 6, namedAgreed: 2, anonymousAgreed: 3, gained: 2, lost: 1,
      bothAgreed: 1, bothDisagreed: 2, changedProposalOrAbstention: 5, netAgreementChange: 1 } });
  expect(packets.map(packet => packet.libraries[0].name === 'Library 1')).toEqual([false, true, true, false, false, true, true, false, false, true, true, false]);
  for (let index = 0; index < packets.length; index += 2) {
    const withoutNames = packet => ({ ...packet, libraries: packet.libraries.map(library => ({ candidate: library.candidate })) });
    expect(withoutNames(packets[index])).toEqual(withoutNames(packets[index + 1]));
  }
  expect(onProgress).toHaveBeenLastCalledWith({ stage: 'paired_comparison', completedCalls: 12, maximumCalls: 12, completedPairs: 6, requested: 6 });
  expect(JSON.stringify(report)).not.toMatch(/Private|overview|destinationId|libraryIds|descriptionHash/);
  expect(report.strata.libraries[3]).toMatchObject({ stratum: 4, requested: 0, validPairs: 0 });
  expect(report.strata.media[1]).toMatchObject({ mediaType: 'tv', requested: 0 });
});

test('shared membership counts in each library but only once in the paired total', async () => {
  const prepared = fixture(1); prepared.cases[0].observedLibraryIds = [1, 2];
  let calls = 0;
  const report = await runContentFirstInventoryComparison(prepared, options(1), {
    client: { generate: async () => ({ response: JSON.stringify({ candidate: ++calls }) }) } });
  expect(report.paired).toMatchObject({ requested: 1, bothAgreed: 1, changedProposalOrAbstention: 1, gained: 0, lost: 0 });
  expect(report.strata.libraries.slice(0, 2).every(row => row.requested === 1 && row.bothAgreed === 1)).toBe(true);
});

test.each(['failed', 'invalid', 'output_limit', 'context_limit', 'context_budget'])('technical %s outcomes never become semantic losses', async kind => {
  let calls = 0;
  const client = { generate: async () => {
    if (++calls > 1) return { response: '{"candidate":1}' };
    if (kind === 'failed' || kind === 'context_budget') throw new Error(kind === 'failed' ? 'Private failure' : 'description_benchmark_context_budget');
    return { response: kind === 'invalid' ? 'Private output' : '{"candidate":1}',
      outputLimitReached: kind === 'output_limit', contextLimitSuspected: kind === 'context_limit' };
  } };
  const report = await runContentFirstInventoryComparison(fixture(1), options(1), { client });
  expect(report).toMatchObject({ status: 'completed_with_errors', calls: 2,
    paired: { completedPairs: 1, validPairs: 0, invalidPairs: 1, gained: 0, lost: 0 } });
  expect(JSON.stringify(report)).not.toContain('Private');
});

test('preflight makes no calls; missing evidence is explicit and never padded', async () => {
  const prepared = fixture(1), client = { generate: jest.fn() };
  expect((await runContentFirstInventoryComparison(prepared, { ...options(1), generateCases: 0 }, { client })).status).toBe('preflight');
  prepared.cases[0].candidates = prepared.cases[0].candidates.map(candidate => ({ ...candidate, items: [] }));
  const report = await runContentFirstInventoryComparison(prepared, options(1), { client });
  expect(report.status).toBe('completed_with_errors');
  expect(report.arms.every(arm => arm.statuses.evidence_unavailable === 1)).toBe(true);
  expect(report.paired.invalidPairs).toBe(1);
  expect(client.generate).not.toHaveBeenCalled();
});

test.each(['before', 'during'])('cancellation %s a pair reports missing pairs without starting later work', async when => {
  const controller = new AbortController();
  if (when === 'before') controller.abort();
  const client = { generate: jest.fn(async () => { controller.abort(); return { response: '{"candidate":1}' }; }) };
  const report = await runContentFirstInventoryComparison(fixture(3), options(3), { client, signal: controller.signal });
  expect(report).toMatchObject({ status: 'interrupted', paired: { missingPairs: 3, validPairs: 0 } });
  expect(client.generate).toHaveBeenCalledTimes(when === 'before' ? 0 : 1);
});

test.each(['holdout', 'query_hash', 'query_text', 'fold', 'media', 'candidate_id', 'observed_id', 'membership', 'missing_text', 'duplicate', 'too_many_items'])('invalid %s evidence fails preflight before calls', async kind => {
  const prepared = fixture(2), entry = prepared.cases[1];
  const first = entry.candidates[0];
  if (kind === 'holdout') entry.heldDescriptionHashes.add(first.items[0].hash);
  if (kind === 'query_hash') entry.descriptionHash = 'invalid';
  if (kind === 'query_text') entry.overview = 'Unexpected private text';
  if (kind === 'fold') entry.foldIndex = 5;
  if (kind === 'media') first.media_type = 'tv';
  if (kind === 'candidate_id') first.id = 9;
  if (kind === 'observed_id') entry.observedLibraryIds = [9];
  if (kind === 'membership') first.items[0].libraryIds = new Set([9]);
  if (kind === 'missing_text') prepared.texts.delete(first.items[0].hash);
  if (kind === 'duplicate') entry.candidates = [first, first];
  if (kind === 'too_many_items') first.items = Array(101).fill(first.items[0]);
  const client = { generate: jest.fn() };
  await expect(runContentFirstInventoryComparison(prepared, { ...options(2), generateCases: 1 }, { client })).rejects.toThrow('evidence_invalid');
  expect(client.generate).not.toHaveBeenCalled();
});

test.each(['folds', 'cases', 'strata', 'duplicate_strata', 'duplicate_library', 'missing_text_map'])('invalid %s scope fails before calls', async kind => {
  const prepared = fixture(1), settings = options(1);
  if (kind === 'folds') settings.folds = 0;
  if (kind === 'cases') prepared.cases.push(prepared.cases[0]);
  if (kind === 'strata') prepared.libraryStrata[0].stratum = 65;
  if (kind === 'duplicate_strata') prepared.libraryStrata[0].stratum = 2;
  if (kind === 'duplicate_library') prepared.libraryStrata[0].id = 2;
  if (kind === 'missing_text_map') prepared.texts = null;
  await expect(runContentFirstInventoryComparison(prepared, settings)).rejects.toThrow('scope_invalid');
});

test('maximum cohort is capped at 600 calls regardless of agreement', async () => {
  const client = { generate: jest.fn(async () => ({ response: '{"candidate":2}' })) };
  const report = await runContentFirstInventoryComparison(fixture(300), options(300), { client });
  expect(client.generate).toHaveBeenCalledTimes(600);
  expect(report.paired).toMatchObject({ requested: 300, validPairs: 300, bothDisagreed: 300 });
  expect(report).toMatchObject({ calls: 600, maximumCalls: 600 });
});

test('snapshot components are invariant to record/key order and expose only aggregate digests', () => {
  const snapshot = { corpus: { documents: [{ key: 'movie:1', hash: hash('Private text'), libraryIds: [2, 1] }] },
    libraries: [{ id: 1, name: 'Private library', media_type: 'movie' }, { id: 2, name: 'Second', media_type: 'movie' }],
    candidateMetadata: new Map([['movie:1', { genres: ['comedy'], studio: 'Private studio' }], ['movie:2', null]]) };
  const vectors = new Map([[hash('Private text'), [1, 0]], [hash('Second'), [0, 1]]]);
  const before = describeInventorySnapshotDigests(snapshot, vectors);
  const reordered = { ...snapshot, corpus: { documents: snapshot.corpus.documents.map(doc => ({ libraryIds: [1, 2], hash: doc.hash, key: doc.key })) },
    libraries: [...snapshot.libraries].reverse().map(library => ({ media_type: library.media_type, name: library.name, id: library.id })),
    candidateMetadata: new Map([['movie:2', null], ['movie:1', { studio: 'Private studio', genres: ['comedy'] }]]) };
  expect(describeInventorySnapshotDigests(reordered, new Map([...vectors].reverse()))).toEqual(before);
  expect(Object.values(before.hashes).every(value => /^[a-f0-9]{64}$/.test(value))).toBe(true);
  expect(JSON.stringify(before)).not.toMatch(/Private|comedy|movie:1/);
  snapshot.libraries[0].name = 'Changed';
  const changed = describeInventorySnapshotDigests(snapshot, vectors);
  expect(changed.hashes.libraries).not.toBe(before.hashes.libraries);
  expect(changed.hashes.documents).toBe(before.hashes.documents);
  vectors.set(hash('Private text'), [0.5, 0.5]);
  expect(describeInventorySnapshotDigests(snapshot, vectors).hashes.vectors).not.toBe(before.hashes.vectors);
  expect(describeInventorySnapshotDigests({ ...snapshot, candidateMetadata: undefined }, vectors).counts.metadata).toBe(0);
});
