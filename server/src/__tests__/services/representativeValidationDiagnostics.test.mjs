/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createRepresentativeValidationDiagnostics, representativeValidationIssue } from '../../services/representativeValidationDiagnostics.mjs';
import { validateRepresentativeVector } from '../../services/representativeValidation.mjs';
import { projectRepresentativeQuery, bindRepresentativeDecision } from '../../services/inventoryRepresentativeShadowInput.mjs';
import { createInventoryRepresentativeShadow } from '../../services/inventoryRepresentativeShadow.mjs';
import { representativeShadowFixture } from '../helpers/inventoryRepresentativeShadowFixture.mjs';

test.each([
  ['shape', null, 2], ['shape', [], 2], ['shape', Array(16001).fill(1), 16001],
  ['dimensions', [1], 2], ['dimensions', [1, 0], 2.5],
  ['dimensions', [1, 0], undefined],
  ['nonfinite', [NaN, 1], 2], ['nonfinite', Array(2), 2], ['nonfinite', ['1', 0], 2],
  ['float32', [1e300, 1], 2], ['float32', [1e-300, 1], 2], ['zero', [0, 0], 2],
])('diagnoses vector %s without retaining its value %#', (cause, vector, dimensions) => {
  for (const source of ['query', 'profile']) {
    try { validateRepresentativeVector(vector, dimensions, source); throw new Error('Expected rejection'); }
    catch (error) { expect(representativeValidationIssue(error)).toBe(`${source}_${cause}`); }
  }
});

test('deduplicates thousands of identical failures, logs reminders and only resolves profile issues', () => {
  let time = 0;
  const log = { warn: jest.fn(), info: jest.fn() }, diagnostics = createRepresentativeValidationDiagnostics({ log, now: () => time });
  for (let i = 0; i < 5000; i++) diagnostics.report('profile_dimensions');
  expect(log.warn).toHaveBeenCalledTimes(1);
  expect(log.warn.mock.calls[0][1]).toMatchObject({ code: 'profile_dimensions', source: 'profile', occurrences: 1, routingAffected: false });
  expect(log.warn.mock.calls[0][1].recovery).toContain('scheduled retry');
  time = -1; diagnostics.report('profile_dimensions');
  expect(log.warn).toHaveBeenCalledTimes(1);
  time = 1_800_000; diagnostics.report('profile_dimensions');
  expect(log.warn).toHaveBeenCalledTimes(2);
  expect(log.warn.mock.calls[1][1].occurrences).toBe(5002);
  diagnostics.report('query_nonfinite'); diagnostics.profilesRecovered(); diagnostics.profilesRecovered();
  expect(log.info).toHaveBeenCalledTimes(1);
  expect(log.info.mock.calls[0][1]).toMatchObject({ code: 'profile_dimensions', occurrences: 5002 });
  diagnostics.report('query_nonfinite'); expect(log.warn).toHaveBeenCalledTimes(3);
});

test('isolates logging failures and invalid clocks; unknown data never enters logs', async () => {
  const log = { warn: jest.fn(() => { throw new Error('PRIVATE'); }), info: jest.fn(() => Promise.reject(new Error('PRIVATE'))) };
  const diagnostics = createRepresentativeValidationDiagnostics({ log });
  expect(() => diagnostics.report('profile_structure')).not.toThrow();
  expect(() => diagnostics.profilesRecovered()).not.toThrow();
  log.warn.mockImplementation(() => Promise.reject(new Error('PRIVATE')));
  diagnostics.report('PRIVATE\nforged message'); diagnostics.report({ toString() { throw new Error('PRIVATE'); } });
  await Promise.resolve();
  expect(JSON.stringify(log.warn.mock.calls)).not.toContain('PRIVATE');
  expect(representativeValidationIssue({ get representativeIssue() { throw new Error('PRIVATE'); } })).toBe('unknown_check');
  const invalidClock = createRepresentativeValidationDiagnostics({ log, now: () => { throw new Error('PRIVATE'); } });
  expect(() => invalidClock.report('profile_zero')).not.toThrow();
  expect(() => createRepresentativeValidationDiagnostics().report('query_shape')).not.toThrow();
});

test('an invalid replacement query clears its older capsule instead of silently reusing stale evidence', async () => {
  const fixture = await representativeShadowFixture(), log = { warn: jest.fn() };
  const shadow = createInventoryRepresentativeShadow({ diagnostics: createRepresentativeValidationDiagnostics({ log }) });
  shadow.remember(fixture.metadata, fixture.query);
  shadow.remember(fixture.metadata, { ...fixture.query, vector: [NaN, 1] });
  shadow.observe(fixture.decision);
  expect(shadow.read()).toMatchObject({ pending: 0, counts: { invalid_input: 1, missing_query: 1 } });
  expect(log.warn.mock.calls[0][1].code).toBe('query_nonfinite');
  shadow.remember(fixture.metadata, fixture.query); shadow.observe(fixture.decision);
  expect(shadow.read().pending).toBe(1);
});

test.each([
  ['query_representation', value => { value.query.identity = {}; }],
  ['query_contract', value => { value.query.request.key = 'movie:wrong'; }],
  ['query_contract', value => { value.query.request = null; }],
  ['query_contract', value => { value.query.request.hash = 'not a hash'; }],
  ['query_dimensions', value => { value.query.vector = [1]; }],
])('records actionable %s at query receipt %#', async (issue, mutate) => {
  const fixture = await representativeShadowFixture(), log = { warn: jest.fn() };
  const diagnostics = createRepresentativeValidationDiagnostics({ log });
  const shadow = createInventoryRepresentativeShadow({ diagnostics }); mutate(fixture);
  shadow.remember(fixture.metadata, fixture.query);
  expect(shadow.read().counts.invalid_input).toBe(1);
  expect(log.warn.mock.calls[0][1]).toMatchObject({ code: issue, source: 'query' });
  expect(log.warn.mock.calls[0][1].steps).toContain(issue === 'query_contract' ? 'Keep the original identity' : 'Do not pad or truncate');
  expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/PRIVATE|90000|digest|vector":\[/);
});

test.each([
  ['decision_identity', decision => { decision.metadata.tmdb_id = 123; }],
  ['decision_identity', decision => { decision.metadata.tmdb_id = null; }],
  ['decision_description', decision => { decision.metadata.overview = 'changed'; }],
  ['decision_contract', decision => { decision.result.needs_retry = true; }],
  ['decision_scope', decision => { decision.result.library.id = 123; }],
  ['decision_scope', decision => { decision.contract.candidates[0] = null; }],
])('distinguishes decision-binding failure %s %#', async (issue, mutate) => {
  const fixture = await representativeShadowFixture(), query = projectRepresentativeQuery(fixture.query);
  mutate(fixture.decision);
  try { bindRepresentativeDecision(query, fixture.decision); throw new Error('Expected rejection'); }
  catch (error) { expect(representativeValidationIssue(error)).toBe(issue); }
});
