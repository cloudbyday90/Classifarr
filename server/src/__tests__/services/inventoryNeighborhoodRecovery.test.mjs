/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';
import { inventoryNeighborhoodRecoverySource } from '../../services/inventoryNeighborhoodRecoverySource.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

async function setup(perLibrary = 12) {
  const fixture = representativeProfileFixture({ perLibrary });
  const { snapshot, identity } = fixture;
  const movie = snapshot.corpus.documents.filter(doc => doc.type === 'movie').map(doc => doc.hash);
  const tv = snapshot.corpus.documents.filter(doc => doc.type === 'tv').map(doc => doc.hash);
  movie.forEach((hash, i) => snapshot.vectors.set(hash, i < perLibrary - 3 ? [1, 0] : [0, 1]));
  tv.forEach(hash => snapshot.vectors.set(hash, [0.2, 1]));
  const model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: identity.dimensions });
  let time = 0;
  const recovery = createInventoryNeighborhoodRecovery({ now: () => time });
  const input = { snapshot, identity, model, configKey: 'PRIVATE configuration' };
  const inspect = (changes = {}) => recovery.prioritize({ ...input, corpus: snapshot.corpus,
    present: new Set(snapshot.vectors.keys()), ...changes });
  return { ...fixture, movie, tv, input, recovery, inspect, advance: ms => { time += ms; } };
}

test('lost minority group is prioritized despite 99% global coverage; backfill restores readiness', async () => {
  const { input, recovery, movie, tv, inspect, snapshot } = await setup(400);
  const prepared = await recovery.prepare(input);
  expect(inspect().summary).toMatchObject({ referencedLibraries: 0, unknownLibraries: 2 });
  prepared.commit();
  const lost = movie.slice(-3);
  const present = new Set([...movie.slice(0, -3), ...tv]);
  expect(present.size / snapshot.vectors.size).toBeGreaterThan(0.99);
  const repair = inspect({ present });
  expect(new Set(repair.priority)).toEqual(new Set(lost));
  expect(repair.summary).toEqual({ referencedLibraries: 2, unknownLibraries: 0, underrepresentedGroups: 1, prioritizedDescriptions: 3 });
  expect(inspect().summary).toMatchObject({ underrepresentedGroups: 0, prioritizedDescriptions: 0 });
  expect(JSON.stringify(repair.summary)).not.toMatch(/PRIVATE|digest|hash|movie|vector|configuration/);
});

test('movie and TV groups are both repaired, lowest coverage first, without name rules', async () => {
  const { input, recovery, movie, tv, inspect } = await setup();
  (await recovery.prepare(input)).commit();
  const present = new Set([...movie.slice(0, -3), ...tv.slice(1)]);
  const repair = inspect({ present });
  // One missing out of twelve TV members is not under-covered; three remaining movie members are all missing.
  expect(new Set(repair.priority)).toEqual(new Set(movie.slice(-3)));
  tv.slice(1, 3).forEach(hash => present.delete(hash));
  const both = inspect({ present });
  expect(new Set(both.priority.slice(0, 3))).toEqual(new Set(movie.slice(-3)));
  expect(new Set(both.priority.slice(3))).toEqual(new Set(tv.slice(0, 3)));
  expect(both.summary.underrepresentedGroups).toBe(2);
});

test('partial fits preserve but cannot renew a complete reference; TTL and restart fall back', async () => {
  const { input, recovery, snapshot, movie, inspect, advance } = await setup();
  (await recovery.prepare(input)).commit();
  snapshot.vectors.delete(movie.at(-1));
  advance(1_700_000);
  input.model = await buildInventoryRepresentativeProfile({ snapshot, dimensions: input.identity.dimensions });
  (await recovery.prepare(input)).commit();
  expect(inspect().priority).toEqual([movie.at(-1)]);
  advance(100_000);
  expect(inspect().summary).toMatchObject({ referencedLibraries: 1, unknownLibraries: 1, prioritizedDescriptions: 0 });
  const restarted = createInventoryNeighborhoodRecovery();
  expect(restarted.prioritize({ ...input, corpus: snapshot.corpus, present: new Set() }).priority).toEqual([]);
});

test.each(['text', 'membership', 'cross_library', 'type'])('%s changes invalidate only affected source memberships', async mode => {
  const { input, recovery, snapshot, movie, inspect } = await setup();
  (await recovery.prepare(input)).commit();
  const doc = snapshot.corpus.documents.find(row => row.hash === movie[0]);
  if (mode === 'text') { doc.hash = 'f'.repeat(64); snapshot.corpus.texts.set(doc.hash, 'CHANGED PRIVATE'); }
  if (mode === 'membership') snapshot.corpus.documents.splice(snapshot.corpus.documents.indexOf(doc), 1);
  if (mode === 'cross_library') doc.libraryIds.push(3);
  if (mode === 'type') snapshot.corpus.documents.filter(row => row.type === 'movie').forEach(row => { row.type = 'tv'; });
  expect(inspect({ present: new Set() }).summary).toMatchObject({ referencedLibraries: 1, unknownLibraries: mode === 'cross_library' ? 2 : 1 });
});

test.each(['model', 'config'])('%s changes discard references and staged publications', async mode => {
  const { input, recovery, inspect } = await setup();
  (await recovery.prepare(input)).commit();
  const staged = await recovery.prepare(input);
  const change = mode === 'model' ? { identity: { ...input.identity, digest: 'b'.repeat(64) } } : { configKey: 'CHANGED PRIVATE' };
  expect(inspect({ ...change, present: new Set() }).priority).toEqual([]);
  staged.commit();
  expect(inspect({ present: new Set() }).priority).toEqual([]);
});

test('duplicate copies do not renew or amplify membership; shared descriptions cannot become exclusive', async () => {
  const { input, recovery, snapshot, movie, inspect } = await setup();
  (await recovery.prepare(input)).commit();
  snapshot.corpus.documents.push({ ...snapshot.corpus.documents[0], key: 'movie:duplicate' });
  expect(inspect({ present: new Set() }).summary.referencedLibraries).toBe(2);
  snapshot.corpus.documents.push({ ...snapshot.corpus.documents[0], key: 'movie:shared', libraryIds: [3] });
  expect(inspect({ present: new Set() }).priority).not.toContain(movie[0]);
  expect(inspect().summary.referencedLibraries).toBe(1);
});

test('invalid support reconstruction and unconverged fits cannot establish a reference', async () => {
  const { input, recovery, inspect } = await setup();
  const profile = input.model.libraries.get(1);
  profile.starts[profile.selectedStart].groups[0].support--;
  (await recovery.prepare(input)).commit();
  expect(inspect().summary.referencedLibraries).toBe(1);
  recovery.clear();
  profile.starts[profile.selectedStart].converged = false;
  (await recovery.prepare(input)).commit();
  expect(inspect().summary.referencedLibraries).toBe(1);
});

test('equal total support with incorrect per-group assignments is rejected', async () => {
  const { input, recovery, inspect } = await setup();
  const groups = input.model.libraries.get(1).starts[input.model.libraries.get(1).selectedStart].groups;
  groups[0].support--; groups[1].support++;
  (await recovery.prepare(input)).commit();
  expect(inspect().summary.referencedLibraries).toBe(1);
});

test('clear, cancellation and newer publication prevent stale commits', async () => {
  const { input, recovery, inspect } = await setup();
  const old = await recovery.prepare(input);
  recovery.clear(); old.commit();
  expect(inspect().summary.referencedLibraries).toBe(0);
  const controller = new AbortController();
  const cancelled = await recovery.prepare({ ...input, signal: controller.signal });
  controller.abort(); cancelled.commit();
  await expect(recovery.prepare({ ...input, signal: controller.signal })).rejects.toThrow();
  const first = await recovery.prepare(input), second = await recovery.prepare(input);
  second.commit(); first.commit();
  expect(inspect().summary.referencedLibraries).toBe(2);
});

test.each([
  corpus => { corpus.documents = null; },
  corpus => { corpus.texts = {}; },
  corpus => { corpus.documents[0].hash = 'PRIVATE'; },
  corpus => { corpus.documents[0].libraryIds = ['1']; },
  corpus => { corpus.documents[0].libraryIds = [2]; },
  corpus => { corpus.documents[0].type = 'unknown'; },
  corpus => { corpus.documents[0].libraryIds = Array.from({ length: 65 }, (_, i) => i + 1); },
])('malformed source falls back at the caller boundary (%#)', async mutate => {
  const { input, snapshot } = await setup();
  mutate(snapshot.corpus);
  expect(() => inventoryNeighborhoodRecoverySource(snapshot.corpus, input.identity, input.configKey)).toThrow('neighborhood_recovery_source_invalid');
});
