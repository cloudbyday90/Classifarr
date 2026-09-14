/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { compareInventoryRepresentativeShadow, representativeNoveltyKey } from '../../services/inventoryRepresentativeShadowScorer.mjs';
import { projectRepresentativeQuery, bindRepresentativeDecision } from '../../services/inventoryRepresentativeShadowInput.mjs';
import { representativeShadowFixture } from '../helpers/inventoryRepresentativeShadowFixture.mjs';

async function context(mediaType) {
  const value = await representativeShadowFixture(mediaType);
  return { ...value, observation: bindRepresentativeDecision(projectRepresentativeQuery(value.query), value.decision) };
}

test.each(['movie', 'tv'])('compares genuinely unseen %s queries without changing the decision or input', async mediaType => {
  const value = await context(mediaType), before = structuredClone(value);
  expect(compareInventoryRepresentativeShadow(value)).toBe('agrees');
  expect(value).toEqual(before);
  value.observation.destinationId = 2;
  expect(compareInventoryRepresentativeShadow(value)).toBe('disagrees');
  value.observation.libraryIds.reverse(); value.snapshot.libraries.forEach(row => { row.name = 'PRIVATE misleading name'; });
  expect(compareInventoryRepresentativeShadow(value)).toBe('disagrees');
});

test.each([
  ['known_item', value => value.snapshot.observedKeys.add(value.observation.key)],
  ['known_description', value => { value.observation.hash = value.snapshot.corpus.texts.keys().next().value; }],
  ['representation_changed', value => { value.observation.identity.digest = 'b'.repeat(64); }],
  ['representation_changed', value => { value.observation.configKey = 'other'; }],
  ['scope_changed', value => { value.observation.libraryIds.push(99); }],
  ['scope_changed', value => { value.model.libraries.get(1).mediaType = 'tv'; }],
  ['scope_changed', value => { value.observation.libraryIds = [1, 1]; }],
  ['unconverged_profiles', value => { value.model.libraries.get(1).starts[0].converged = false; }],
  ['invalid_input', value => { value.model.libraries.get(1).selectedStart = 3; }],
  ['sparse_profiles', value => { value.model.libraries.get(1).starts[0].groups = []; }],
  ['sparse_profiles', value => { value.model.libraries.get(1).starts[0].groups[0].support = 2; }],
  ['tied_destinations', value => { value.model.libraries.get(2).starts = structuredClone(value.model.libraries.get(1).starts); }],
  ['invalid_input', value => { value.observation.vector = [NaN, 1]; }],
  ['invalid_input', value => { value.model.kind = 'held_out'; }],
  ['invalid_input', value => { value.snapshot.observedKeys = undefined; }],
])('returns bounded reason %s for unsuitable evidence', async (expected, mutate) => {
  const value = await context(); mutate(value);
  expect(compareInventoryRepresentativeShadow(value)).toBe(expected);
});

test('requires agreement across coherent starts AND the selected mixed view', async () => {
  const value = await context();
  value.model.libraries.get(1).starts[1].groups[0].centroid = [0, 1];
  value.model.libraries.get(2).starts[1].groups[0].centroid = [1, 0];
  expect(compareInventoryRepresentativeShadow(value)).toBe('initialization_sensitive');
});

test('novelty digest includes descriptionless identities, ignores order, and rejects invalid scope', async () => {
  const { snapshot } = await context(); const key = representativeNoveltyKey(snapshot);
  snapshot.observedKeys = new Set([...snapshot.observedKeys].reverse());
  expect(representativeNoveltyKey(snapshot)).toBe(key);
  snapshot.observedKeys.add('movie:123'); expect(representativeNoveltyKey(snapshot)).not.toBe(key);
  snapshot.observedKeys.add('private text'); expect(() => representativeNoveltyKey(snapshot)).toThrow('novelty_snapshot_invalid');
});

test('capsules reject changed metadata, foreign decisions and malformed vectors', async () => {
  const value = await context();
  expect(() => projectRepresentativeQuery({ ...value.query, configKey: 'x'.repeat(2049) })).toThrow('query_invalid');
  expect(() => projectRepresentativeQuery({ ...value.query, request: { ...value.query.request, key: 'movie:01' } })).toThrow();
  const query = projectRepresentativeQuery(value.query);
  expect(Object.keys(query)).not.toContain('title');
  value.decision.metadata.overview = 'changed';
  expect(() => bindRepresentativeDecision(query, value.decision)).toThrow('decision_invalid');
  value.decision.metadata = value.metadata = { media_type: 'movie', tmdb_id: 90000, overview: 'PRIVATE unseen voyage' };
  value.decision.result.library.id = 999;
  expect(() => bindRepresentativeDecision(query, value.decision)).toThrow('decision_scope_invalid');
});
