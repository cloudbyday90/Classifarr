/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { fitRepresentativeGeometry } from '../../services/inventoryRepresentativeGeometry.mjs';
import { fitStableRepresentativeGeometry } from '../../services/inventoryRepresentativeStability.mjs';
import { buildInventoryRepresentativeProfile } from '../../services/inventoryRepresentativeProfile.mjs';
import { validateInventoryRepresentativeProfileCoverage } from '../../services/inventoryRepresentativeProfileValidation.mjs';
import { createInventoryNeighborhoodRecovery } from '../../services/inventoryNeighborhoodRecovery.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';
import { validatedRecoveryGroups, validatedRecoveryGroupsStreamed } from '../../services/inventoryRepresentativeMembership.mjs';

async function fixture(outliers = 1) {
  const data = representativeProfileFixture({ perLibrary: 14 });
  for (const id of [1, 2]) data.snapshot.corpus.documents.filter(doc => doc.libraryIds.includes(id))
    .forEach((doc, index) => data.snapshot.vectors.set(doc.hash, index < 14 - outliers ? [1, 0] : [0, 1]));
  const model = await buildInventoryRepresentativeProfile({ snapshot: data.snapshot, dimensions: 2 });
  return { ...data, model, configKey: 'PRIVATE config' };
}

test.each([1, 2])('supported groups recover in both media types despite %i unassigned descriptions', async outliers => {
  const input = await fixture(outliers), recovery = createInventoryNeighborhoodRecovery();
  (await recovery.prepare(input)).commit(input.snapshot);
  const present = new Set(input.snapshot.vectors.keys()), lost = [], unassigned = [];
  for (const profile of input.model.libraries.values()) {
    expect(profile.membership.groups).toHaveLength(1);
    expect(profile.membership.unassigned).toHaveLength(outliers);
    lost.push(...profile.membership.groups[0].slice(0, 2));
    unassigned.push(...profile.membership.unassigned);
  }
  [...lost, ...unassigned].forEach(hash => present.delete(hash));
  const inspect = () => recovery.prioritize({ ...input, corpus: input.snapshot.corpus, present });
  expect(inspect().summary).toEqual({ referencedLibraries: 2, unknownLibraries: 0, underrepresentedGroups: 2, prioritizedDescriptions: 4 });
  expect(new Set(inspect().priority)).toEqual(new Set(lost));
  // References own their arrays; corrupting a caller's fit cannot change published priority.
  input.model.libraries.get(1).membership.groups[0].fill('f'.repeat(64));
  expect(new Set(inspect().priority)).toEqual(new Set(lost));
  lost.forEach(hash => present.add(hash));
  expect(inspect().priority).toEqual([]); // Remaining unassigned items still belong to ordinary backfill.
});

test('membership capture preserves default geometry, stability and benchmark control outputs', async () => {
  const items = Array.from({ length: 14 }, (_, i) => ({ hash: i.toString(16).padStart(64, '0'), vector: i < 12 ? [1, 0] : [0, 1] }));
  for (const recoverUnconverged of [false, true]) {
    const baseline = await fitStableRepresentativeGeometry(items, { recoverUnconverged });
    const { membership, ...captured } = await fitStableRepresentativeGeometry(items, { recoverUnconverged, retainMemberships: true });
    expect(captured).toEqual(baseline);
    expect(membership.groups[0]).toHaveLength(12);
    expect(membership.unassigned).toEqual(items.slice(12).map(row => row.hash));
    expect(captured.runs.every(run => !Object.hasOwn(run, 'membership'))).toBe(true);
  }
  await expect(fitStableRepresentativeGeometry(items, { retainMemberships: 'true' })).rejects.toThrow('fit_options');
});

test.each([0, 2, 6])('empty, sparse and zero-mean fits explicitly account for %i source items', async count => {
  const items = Array.from({ length: count }, (_, i) => ({ hash: i.toString(16).padStart(64, '0'), vector: i % 2 ? [-1, 0] : [1, 0] }));
  const { membership, ...fit } = await fitRepresentativeGeometry(items, { retainMemberships: true });
  expect(fit).toEqual(await fitRepresentativeGeometry(items));
  expect(membership).toEqual({ groups: [], unassigned: items.map(row => row.hash) });
});

test.each([
  profile => { delete profile.membership; },
  profile => { profile.membership.groups = null; },
  profile => { profile.membership.groups.push([]); },
  profile => { profile.membership.unassigned.push(...profile.membership.groups[0]); delete profile.membership.groups[0]; },
  profile => { profile.membership.unassigned = null; },
  profile => { profile.membership.unassigned.push(...profile.membership.groups[0]); },
  profile => { profile.membership.unassigned = []; },
  profile => { profile.membership.groups[0][0] = profile.membership.groups[0][1]; },
  profile => { profile.membership.groups[0][0] = 'f'.repeat(64); },
  profile => { profile.membership.groups[0][0] = 'PRIVATE'; },
  profile => { delete profile.membership.groups[0][0]; },
  profile => { profile.membership.extra = 'PRIVATE'; },
  profile => { profile.starts[profile.selectedStart].groups[0].support--; },
  profile => { profile.starts[profile.selectedStart].groups[0].representatives = ['f'.repeat(64)]; },
  profile => { profile.starts[profile.selectedStart].groups[0].representatives[0] = 'f'.repeat(64); },
  profile => { profile.starts[profile.selectedStart].groups[0].representatives.fill(profile.membership.groups[0][0]); },
  profile => { delete profile.starts[profile.selectedStart].groups[0].representatives[0]; },
])('rejects malformed partitions without promoting or disclosing them (%#)', async mutate => {
  const input = await fixture(); mutate(input.model.libraries.get(1));
  expect(() => validateInventoryRepresentativeProfileCoverage(input.model, input.snapshot, 2)).toThrow('representative_validation_failed');
  await expect(createInventoryNeighborhoodRecovery().prepare(input)).rejects.toMatchObject({ representativeIssue: 'profile_structure' });
});

test.each(['other_library', 'shared', 'unavailable'])('%s hashes cannot become selected members', async mode => {
  const input = await fixture(), profile = input.model.libraries.get(1);
  const hash = profile.membership.groups[0][0];
  if (mode === 'other_library') profile.membership.groups[0][0] = input.model.libraries.get(2).membership.groups[0][0];
  if (mode === 'shared') {
    input.snapshot.libraries.push({ id: 3, media_type: 'movie' });
    input.snapshot.corpus.documents.find(doc => doc.hash === hash).libraryIds.push(3);
  }
  if (mode === 'unavailable') input.snapshot.vectors.delete(hash);
  await expect(createInventoryNeighborhoodRecovery().prepare(input)).rejects.toMatchObject({ representativeIssue: 'profile_structure' });
});

test.each(['centroid', 'swapped', 'zero_mean'])('source geometry rejects %s even with correct membership counts', async mode => {
  const input = await fixture(), profile = input.model.libraries.get(1);
  if (mode === 'centroid') profile.starts[profile.selectedStart].groups[0].centroid = [0, 1];
  if (mode === 'swapped') {
    const members = profile.membership.groups[0], unassigned = profile.membership.unassigned;
    const index = members.findIndex(hash => !profile.starts[profile.selectedStart].groups[0].representatives.includes(hash));
    [members[index], unassigned[0]] = [unassigned[0], members[index]];
  }
  if (mode === 'zero_mean') {
    const even = await fixture(2);
    const members = even.model.libraries.get(1).membership.groups[0];
    members.forEach((hash, index) => even.snapshot.vectors.set(hash, index % 2 ? [-1, 0] : [1, 0]));
    Object.assign(input, even);
  }
  expect(() => validateInventoryRepresentativeProfileCoverage(input.model, input.snapshot, 2)).not.toThrow();
  await expect(createInventoryNeighborhoodRecovery().prepare(input)).rejects.toMatchObject({ representativeIssue: 'profile_structure' });
});

test('geometry validation cooperatively aborts before publication', async () => {
  const input = await fixture(), controller = new AbortController();
  const recovery = createInventoryNeighborhoodRecovery();
  const pending = recovery.prepare({ ...input, signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(recovery.prioritize({ ...input, corpus: input.snapshot.corpus, present: new Set() }).priority).toEqual([]);
});

test.each(['unchanged', 'centroid', 'swapped', 'zero_mean'])('streamed geometry matches full-map validation for %s evidence', async mode => {
  const input = await fixture(2), profile = input.model.libraries.get(1);
  if (mode === 'centroid') profile.starts[profile.selectedStart].groups[0].centroid = [0, 1];
  if (mode === 'swapped') {
    const members = profile.membership.groups[0], unassigned = profile.membership.unassigned;
    [members[0], unassigned[0]] = [unassigned[0], members[0]];
  }
  if (mode === 'zero_mean') profile.membership.groups[0].forEach((hash, index) => input.snapshot.vectors.set(hash, index % 2 ? [-1, 0] : [1, 0]));
  const read = async hashes => new Map(hashes.map(hash => [hash, input.snapshot.vectors.get(hash)]));
  const full = validatedRecoveryGroups(profile, input.snapshot.vectors, 2);
  const streamed = validatedRecoveryGroupsStreamed(profile, read, 2);
  const results = await Promise.allSettled([full, streamed]);
  expect(results[1].status).toBe(results[0].status);
  if (mode === 'unchanged') expect(results[1].value).toEqual(results[0].value);
  else expect(results.map(row => row.reason.representativeIssue)).toEqual(['profile_structure', 'profile_structure']);
});

test('streamed geometry bounds components and preserves membership order across batches', async () => {
  const dimensions = 16000, hashes = Array.from({ length: 40 }, (_, i) => i.toString(16).padStart(64, '0'));
  const vector = Array(dimensions).fill(0); vector[0] = 1;
  const profile = { coverage: { status: 'complete' }, selectedStart: 0,
    starts: [{ converged: true, groups: [{ centroid: vector }] }], membership: { groups: [hashes] } };
  const calls = [];
  expect(await validatedRecoveryGroupsStreamed(profile, async batch => {
    calls.push(batch); return new Map(batch.map(hash => [hash, vector]));
  }, dimensions)).toEqual([hashes]);
  expect(calls.map(batch => batch.length)).toEqual([16, 16, 8]); expect(calls.flat()).toEqual(hashes);
});
