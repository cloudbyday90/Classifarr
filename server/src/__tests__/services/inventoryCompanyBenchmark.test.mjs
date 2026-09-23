/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { benchmarkInventoryCompanyProfiles } from '../../services/inventoryCompanyBenchmark.mjs';
import { inventoryCompanyFixture } from '../fixtures/inventoryCompanyFixture.mjs';

const options = { seed: 'company-study-20260922', size: 300, folds: 3 };
test('300 held-out movie/TV samples measure company coverage and placement agreement without routing', () => {
  const fixture = inventoryCompanyFixture();
  const report = benchmarkInventoryCompanyProfiles(fixture, options);
  expect(report.sampleSize).toBe(300);
  for (const type of ['movie', 'tv']) expect(report.media[type]).toEqual({ sampled: 150, observedCompanies: 150,
    baselineDecisions: 0, baselineAgreements: 0, companyDecisions: 150, companyAgreements: 150, pairedDecisions: 0, changedDecisions: 0 });
  expect(report.libraries).toHaveLength(6);
  expect(report.libraries.every(row => row.sampled === 50 && row.companyAgreements === 50)).toBe(true);
  expect(report).toMatchObject({ providerCalls: 0, routingChanges: 0, independentOutcomeLabels: 0 });
  expect(JSON.stringify(report)).not.toMatch(/Producer|Synthetic|tmdb:|company_observation|libraryId/);
  expect(benchmarkInventoryCompanyProfiles(fixture, options)).toEqual(report);
});

test('paired changes require two decisions; missing company observations are not reported as changed destinations', () => {
  const fixture = inventoryCompanyFixture(6);
  fixture.rows = fixture.rows.map(row => ({ ...row, studio: `studio-${row.library_id}` }));
  const result = benchmarkInventoryCompanyProfiles(fixture, options);
  expect(result.media.movie.pairedDecisions).toBe(18);
  expect(result.media.movie.changedDecisions).toBe(0);
  const noCompanies = benchmarkInventoryCompanyProfiles({ ...fixture, rows: fixture.rows.map(row => ({ ...row, company_observation: null })) }, options);
  expect(noCompanies.media.movie.baselineDecisions).toBe(18);
  expect(noCompanies.media.movie.pairedDecisions).toBe(0);
  expect(noCompanies.media.movie.changedDecisions).toBe(0);
});

test('legacy missing-company coverage is reported honestly, not fabricated from studio', () => {
  const fixture = inventoryCompanyFixture(3);
  fixture.rows = fixture.rows.map(row => ({ ...row, studio: 'Company name', company_observation: undefined }));
  const report = benchmarkInventoryCompanyProfiles(fixture, options);
  expect(report.sampleSize).toBe(18);
  expect(report.media.movie.companyDecisions).toBe(0);
  expect(report.media.tv.observedCompanies).toBe(0);
  expect(() => benchmarkInventoryCompanyProfiles(fixture, { ...options, folds: 0 })).toThrow('grouped');
  expect(() => benchmarkInventoryCompanyProfiles(fixture, { ...options, generateCases: 1 })).toThrow('grouped');
});
