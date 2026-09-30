/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createStudyProviderHttp } from '../../scripts/resourceStudyProviderHttp.mjs';
import { seedStudyProviderCohort, resetStudyProviderDay, repairStudyProviderCredential } from '../../scripts/resourceStudyProviderFixture.mjs';
import { assertStudyProviderReceipt } from '../../scripts/resourceStudyProviderReceipt.mjs';
import { resourceStudyReceiptFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';
import { assertResourceStudyReceipt } from '../../scripts/resourceStudyProfiles.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';
import { classifyOmdbResponse } from '../../services/omdbResponseClassifier.mjs';
import { runResourceStudyWorkload } from '../../scripts/resourceStudyWorkload.mjs';

afterEach(() => jest.restoreAllMocks());
test('provider fixture refuses ordinary environments before opening a socket or database mutation', async () => {
  const db = { query: jest.fn(), withTransaction: jest.fn() };
  await expect(createStudyProviderHttp()).rejects.toThrow();
  await expect(runResourceStudyWorkload(db, 'smoke')).rejects.toThrow();
  await expect(seedStudyProviderCohort(db)).rejects.toThrow();
  await expect(resetStudyProviderDay(db, { configId: 1 })).rejects.toThrow();
  await expect(repairStudyProviderCredential(db, { configId: 1 })).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled(); expect(db.withTransaction).not.toHaveBeenCalled();
});

test('loopback fault transport is bounded, type-correct and rejects unexpected requests', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, ...resourceStudyEnvironment });
  const server = await createStudyProviderHttp();
  const url = `${server.url}/?t=Synthetic+study-2-tv+0&type=series&apikey=synthetic-fault-before`;
  try {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    for (const status of [401, 429, 503, 200]) {
      const response = await fetch(url); expect(response.status).toBe(status);
      if (status === 429) expect(response.headers.get('retry-after')).toBe('2');
      if (status === 200) {
        const data = await response.json();
        expect(data).toMatchObject({ Type: 'series', Response: 'True' });
        expect(classifyOmdbResponse(data, status).kind).toBe('success');
      } else await response.arrayBuffer();
    }
    expect((await fetch(`${server.url}/unexpected`)).status).toBe(400);
    for (let n = 5; n < 32; n++) await (await fetch(url)).arrayBuffer();
    expect((await fetch(url)).status).toBe(400);
    expect(server.receipt).toMatchObject({ httpAttempts: 33, unexpected: 2, authentication: 1, throttled: 1, unavailable: 1 });
  } finally { await server.close(); await server.close(); }
});

test.each([{ cohortSize: 9 }, { uniqueCompleted: 7 }, { pending: 1 }, { chargedAttempts: 3 },
  { httpAttempts: 12 }, { httpAttempts: '11' }, { successes: 7 }, { unexpected: 1 }, { authentication: 0 },
  { throttled: 0 }, { unavailable: 0 }, { resets: 0 }, { repairs: 0 }, { peakPending: 0 },
  { preservedWaitChecks: 1 }, { preservedWaitChecks: undefined }, { pressureDeferrals: 1 },
  { passes: NaN }, { passes: 1 }, { transientMinWaitMs: 1000 }, { transientMinWaitMs: Infinity },
  { recoveryMs: null }, { recoveryMs: 240001 }, { httpDuringPressure: 1 }, { maxActive: 2 }])('provider receipt rejects %j', change => {
  const study = resourceStudyReceiptFixture(); Object.assign(study.providerRecovery, change);
  expect(() => assertStudyProviderReceipt(study.providerRecovery)).toThrow('provider_receipt_invalid');
  expect(() => assertResourceStudyReceipt(study, 'smoke')).toThrow('provider_receipt_invalid');
});

test('current receipt requires unique completions and cannot accept old no-op observations', () => {
  const study = resourceStudyReceiptFixture();
  expect(() => assertResourceStudyReceipt({ ...study, version: 'resource_study.v5' }, 'smoke')).toThrow();
  expect(() => assertResourceStudyReceipt({ ...study, uniqueCompleted: 399 }, 'smoke')).toThrow();
  study.providerRecovery.private = 'SECRET';
  const report = formatResourceStudySummary({ mode: 'smoke', budget: 'baseline', cleanup: 'passed', study });
  expect(report).toContain('HTTP attempts'); expect(report).toContain('**400/400**');
  expect(report).toContain('Providers remain configured'); expect(report).not.toContain('SECRET');
});
