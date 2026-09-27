/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createMediaSyncRecoveryWorkflow } from '../services/mediaSyncRecoveryWorkflow.mjs';
import { createMediaSyncIdentityRecovery } from '../services/mediaSyncIdentityRecovery.mjs';
import { sourceIdentityRecoveryEvidence } from '../services/sourceIdentityRecoveryEvidence.mjs';

function fixture(index, mediaType = 'movie') {
  const item = { external_id: String(index).padStart(4, '0'), title: 'Fixture', year: 2001, media_type: mediaType,
    provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids' };
  item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'library-1',
    { tmdb_id: [11, 22], imdb_id: ['tt123'], tvdb_id: [] });
  return item;
}
function setup(overrides = {}) {
  const tmdbService = {
    findIdentityByExternalId: jest.fn().mockResolvedValue({ movie_results: [{ id: 22 }], tv_results: [{ id: 22 }] }),
    getIdentityDetails: jest.fn().mockResolvedValue({ id: 22, title: 'Fixture', name: 'Fixture', release_date: '2001-01-01', first_air_date: '2001-01-01' }),
  };
  const upsert = jest.fn();
  const service = { getLibraryItemIdentityEvidence: jest.fn(async (_url, _key, _library, id) => fixture(Number(id)).source_identity_evidence) };
  const dependencies = { store: { withCurrentCapture: async (_c, fn) => fn({ query: async () => ({ rowCount: 1 }) }) },
    context: { libraryId: 1, mediaServerId: 1, generation: 1 },
    recovery: createMediaSyncIdentityRecovery({ tmdbService }),
    source: { service, libraryKey: 'library-1' }, upsert,
    logger: { warn: jest.fn() }, persistRecovery: jest.fn().mockResolvedValue(true),
    readPriority: jest.fn().mockResolvedValue({ attemptedAt: null }),
    readReceipt: jest.fn().mockResolvedValue(null), claimAttempt: jest.fn().mockResolvedValue(true), ...overrides };
  return { ...dependencies, service, tmdbService, workflow: createMediaSyncRecoveryWorkflow(dependencies) };
}

test('later-page never-attempted items displace early retries without extra calls or skip counts', async () => {
  const t = setup({ readPriority: async item => ({ attemptedAt: Number(item.external_id) < 92 ? 100 : null }) });
  let completed = 0;
  for (let index = 0; index < 100; index++) {
    completed += await t.workflow.process(fixture(index));
    expect(t.workflow.pendingCount).toBeLessThanOrEqual(8);
  }
  expect(completed).toBe(92);
  expect(t.claimAttempt).not.toHaveBeenCalled();
  expect(t.tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
  completed += await t.workflow.flush();
  expect(completed).toBe(100);
  expect(t.claimAttempt.mock.calls.map(([item]) => item.external_id)).toEqual(Array.from({ length: 8 }, (_, i) => String(92+i).padStart(4, '0')));
  expect(t.upsert).toHaveBeenCalledTimes(92);
  expect(t.persistRecovery).toHaveBeenCalledTimes(8);
  expect(t.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(8);
  expect(await t.workflow.flush()).toBe(0);
  await expect(t.workflow.process(fixture(200))).rejects.toThrow('closed');
});

test.each(['movie', 'tv'])('stable 100-item %s outage covers every item over 13 daily sessions at the same budget', async mediaType => {
  const ledger = new Map(); let now = 0; let calls = 0;
  const DAY = 86400000;
  for (let cycle = 0; cycle < 13; cycle++) {
    now += DAY + 1000;
    const t = setup({
      readPriority: async item => {
        const time = ledger.get(item.external_id);
        return time !== undefined && now-time < DAY ? null : { attemptedAt: time ?? null };
      },
      claimAttempt: jest.fn(async item => {
        const time = ledger.get(item.external_id);
        if (time !== undefined && now-time < DAY) return false;
        ledger.set(item.external_id, now); return true;
      }),
    });
    t.tmdbService.findIdentityByExternalId.mockRejectedValue(new Error('synthetic outage'));
    for (let index = 0; index < 100; index++) await t.workflow.process(fixture(index, mediaType));
    expect(await t.workflow.flush()).toBe(8);
    expect(t.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(8);
    calls += t.tmdbService.findIdentityByExternalId.mock.calls.length;
    expect(t.persistRecovery).not.toHaveBeenCalled();
  }
  expect(ledger.size).toBe(100);
  expect(calls).toBe(104);
});

test('cooldown, malformed priority and unprovable evidence never occupy the shortlist', async () => {
  const t = setup({ readPriority: async item => Number(item.external_id) === 0 ? null : { attemptedAt: NaN } });
  const invalid = fixture(2); invalid.source_identity_evidence = null;
  for (const item of [fixture(0), fixture(1), invalid]) expect(await t.workflow.process(item)).toBe(1);
  expect(t.workflow.pendingCount).toBe(0);
  expect(await t.workflow.flush()).toBe(0);
  expect(t.claimAttempt).not.toHaveBeenCalled();
});

test('changed, valid duplicate withdraws the earlier buffered conflict', async () => {
  const t = setup(); await t.workflow.process(fixture(0));
  expect(await t.workflow.process({ external_id: '0000', media_type: 'movie', tmdb_id: 22 })).toBe(2);
  expect(await t.workflow.flush()).toBe(0);
  expect(t.claimAttempt).not.toHaveBeenCalled();
  expect(t.upsert).toHaveBeenCalledTimes(2);
});

test('claim denial at drain makes no provider request and reports the ordinary unresolved item', async () => {
  const t = setup({ claimAttempt: jest.fn().mockResolvedValue(false) });
  await t.workflow.process(fixture(0));
  expect(await t.workflow.flush()).toBe(1);
  expect(t.upsert).toHaveBeenCalledTimes(1);
  expect(t.tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
});

test.each([false, 'error'])('failed persistence preserves the item and records an outcome: %s', async result => {
  const persistRecovery = result === 'error' ? jest.fn().mockRejectedValue(new Error('private detail')) : jest.fn().mockResolvedValue(false);
  const t = setup({ persistRecovery }); await t.workflow.process(fixture(0));
  expect(await t.workflow.flush()).toBe(1);
  expect(t.upsert).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(t.logger.warn.mock.calls)).not.toContain('private detail');
});

test('recent persisted receipts still recover during the scan without taking a shortlist slot', async () => {
  const item = fixture(0);
  const t = setup({ readReceipt: async () => ({ version: 1, method: 'external_candidate_agreement', tmdb_id: 22,
    source_digest: item.source_identity_evidence.snapshotDigest, verified_at: new Date().toISOString() }) });
  expect(await t.workflow.process(item)).toBe(1);
  expect(t.workflow.pendingCount).toBe(0);
  expect(t.persistRecovery).toHaveBeenCalledTimes(1);
  expect(t.readPriority).not.toHaveBeenCalled();
  expect(t.tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
});
