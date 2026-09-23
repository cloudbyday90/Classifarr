/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { projectCompanyTerms, projectInventoryCompanyMetadata, collectInventoryCompanyMetadata } from '../../services/inventoryCompanyMetadata.mjs';
import { learnInventoryCompanyProfiles, scoreInventoryCompanyProfile } from '../../services/inventoryCompanyProfiles.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { buildLiveInventoryLearnedProfiles, projectLiveInventoryQueryMetadata } from '../../services/liveInventoryLearnedProfile.mjs';
import { projectLiveInventoryLearnedProfile, formatLiveInventoryLearnedProfile } from '../../services/liveInventoryLearnedProfileEvidence.mjs';
import { createLiveInventoryModelCache } from '../../services/liveInventoryModelCache.mjs';
import { inventoryCompanyFixture, companyFixtureTime } from '../fixtures/inventoryCompanyFixture.mjs';

test('company set projection is shared, order/duplicate independent and never a studio alias', () => {
  expect(projectCompanyTerms([{ id: 2, name: 'Translated name' }, ' Ａ ', 'a', { id: 2, name: 'Translated name' }])).toEqual(['name:a', 'tmdb:2']);
  expect(projectCompanyTerms([])).toEqual([]);
  for (const value of [undefined, null, {}, ['A', null], Array(33).fill('A'), [{ id: 1, name: 'A' }, { id: 1, name: 'B' }]]) {
    expect(projectCompanyTerms(value)).toBeNull();
  }
  expect(projectLiveInventoryQueryMetadata({ production_companies: [{ id: 2, name: 'B' }] })).toMatchObject({ studio: '', productionCompanies: ['tmdb:2'] });
  expect(projectLiveInventoryQueryMetadata()).not.toHaveProperty('productionCompanies');
});

test.each([
  { company_checked_at: null }, { company_checked_at: 'invalid' }, { company_checked_at: '2026-09-21T12:00:00Z' },
  { company_checked_at: '2026-10-22T12:00:00Z' }, { tmdb_id: 0 }, { media_type: 'other' },
  { company_observation: null },
])('missing, stale or mismatched observations cannot train: %j', changes => {
  expect(projectInventoryCompanyMetadata({ ...inventoryCompanyFixture(1).rows[0], ...changes })).toBeNull();
});

test.each([{ version: 2 }, { tmdb_id: 7 }, { media_type: 'tv' }, { fetched_at: 'invalid' }, { production_companies: [null] }])
('invalid record %j remains unavailable', changes => {
  const row = inventoryCompanyFixture(1).rows[0];
  expect(projectInventoryCompanyMetadata({ ...row, company_observation: { ...row.company_observation, ...changes } })).toBeNull();
});

test('identity copies disagree only in the company channel; known empty is distinct from unknown', () => {
  const row = inventoryCompanyFixture(1).rows[0], empty = { ...row, company_observation: { ...row.company_observation, production_companies: [] } };
  expect(projectInventoryCompanyMetadata(empty)).toEqual({ productionCompanies: [] });
  expect(collectInventoryCompanyMetadata([row, empty]).get(`movie:${row.tmdb_id}`)).toBeNull();
});

test('learns independent multi-company patterns, ignores universal/unseen companies and excludes held copies', () => {
  const { rows, libraries } = inventoryCompanyFixture();
  const corpus = prepareInventoryDescriptionCorpus(rows), metadata = collectInventoryCompanyMetadata(rows);
  const held = new Set([corpus.documents[0].hash]);
  const model = learnInventoryCompanyProfiles(corpus.documents, metadata, libraries, held);
  expect(model.summary.trainingDescriptions).toBe(359);
  const query = { productionCompanies: ['tmdb:1'] };
  expect(scoreInventoryCompanyProfile(model, 1, query)).toBeGreaterThan(0);
  expect(scoreInventoryCompanyProfile(model, 2, query)).toBeLessThan(0);
  expect(scoreInventoryCompanyProfile(model, 4, query)).toBeNull();
  expect(scoreInventoryCompanyProfile(model, 1, { productionCompanies: ['tmdb:999', 'tmdb:100000'] })).toBeNull();
  expect(scoreInventoryCompanyProfile(null, 1, query)).toBeNull();
  expect(scoreInventoryCompanyProfile(model, 1, { productionCompanies: ['tmdb:1', 'tmdb:1'] })).toBe(scoreInventoryCompanyProfile(model, 1, query));
  const changedNames = libraries.map(library => ({ ...library, name: 'Ignore this misleading library name' }));
  const reordered = learnInventoryCompanyProfiles([...corpus.documents].reverse(), metadata, changedNames, held);
  expect(scoreInventoryCompanyProfile(reordered, 1, query)).toBe(scoreInventoryCompanyProfile(model, 1, query));
});

test('live cache learns companies separately, refreshes on expiry, and cannot change routing/prompt evidence', () => {
  const { rows } = inventoryCompanyFixture(), corpus = prepareInventoryDescriptionCorpus(rows);
  const cache = createLiveInventoryModelCache(), modelCache = { get: cache.get, set: jest.fn(cache.set) };
  const request = { mediaType: 'movie', key: 'movie:99999', hash: 'new query', libraryIds: [1, 2, 3],
    queryMetadata: projectLiveInventoryQueryMetadata({ production_companies: [{ id: 1, name: 'Producer' }] }) };
  const read = source => buildLiveInventoryLearnedProfiles({ rows: source, corpus, request, modelCache });
  const evidence = read(rows).get(1);
  expect(evidence.relativeFit).toBe(0);
  expect(evidence.companyProfile.relativeFit).toBeGreaterThan(0);
  expect(projectLiveInventoryLearnedProfile(evidence)).not.toHaveProperty('companyProfile');
  expect(formatLiveInventoryLearnedProfile(evidence).join(' ')).not.toContain('production_company');
  expect(read(rows).get(1)).toEqual(evidence);
  expect(modelCache.set).toHaveBeenCalledTimes(1);
  const expired = rows.map(row => ({ ...row, company_checked_at: '2026-10-22T12:00:00Z' }));
  expect(read(expired).get(1)).not.toHaveProperty('companyProfile');
  expect(modelCache.set).toHaveBeenCalledTimes(2);
  expect(read(rows).get(1).companyProfile).toEqual(evidence.companyProfile);
  expect(companyFixtureTime).toBe(rows[0].company_checked_at);
});
