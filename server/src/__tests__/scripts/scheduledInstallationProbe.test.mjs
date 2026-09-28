/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { waitForScheduledProgress, runScheduledInstallationProbe } from '../../scripts/scheduledInstallationProbe.mjs';
import { createScheduledInstallationFixture, seedScheduledInstallation } from '../../scripts/scheduledInstallationFixture.mjs';

const guard = { CLASSIFARR_UPGRADE_DRILL: 'isolated-compose-v1', POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432',
  POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr', BACKUP_DIR: '/app/data/backups', MIGRATIONS_DIR: '/app/database/migrations' };
let previous;
beforeEach(() => { previous = Object.fromEntries(Object.keys(guard).map(key => [key, process.env[key]])); Object.assign(process.env, guard); });
afterEach(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

test('wait observes progress without initiating work', async () => {
  const check = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const sleep = jest.fn();
  await waitForScheduledProgress(check, 'ingestion_started', { sleep, now: () => 0 });
  expect(check).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledWith(500);
});
test('stalled progress has a finite deadline and a fixed failure classification', async () => {
  let time = 0;
  await expect(waitForScheduledProgress(async () => false, 'metadata_and_profiles',
    { timeout: 1000, now: () => time, sleep: async ms => { time += ms; } }))
    .rejects.toThrow('scheduled_installation_timeout:metadata_and_profiles');
  expect(time).toBe(1000);
});
test.each([0, -1, Infinity, 420001, 1.5])('rejects invalid wait bound %s', async timeout => {
  await expect(waitForScheduledProgress(jest.fn(), 'refill_lock', { timeout })).rejects.toThrow('invalid_scheduler_wait');
});
test('fixture and probe refuse non-drill environments before DB access', async () => {
  delete process.env.CLASSIFARR_UPGRADE_DRILL;
  const query = jest.fn();
  await expect(runScheduledInstallationProbe({ query })).rejects.toThrow();
  await expect(seedScheduledInstallation({ query }, 'http://127.0.0.1:1')).rejects.toThrow();
  await expect(createScheduledInstallationFixture()).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
});
test('seeding rejects external source origins', async () => {
  await expect(seedScheduledInstallation({}, 'https://example.com')).rejects.toThrow('scheduler_fixture_origin_invalid');
});
test('synthetic wire server releases a held request and includes unsupported audio', async () => {
  const fixture = await createScheduledInstallationFixture();
  try {
    const result = fetch(`${fixture.origin}/Items?ParentId=scheduler-movie&StartIndex=0&Limit=100`);
    await waitForScheduledProgress(() => fixture.reached, 'ingestion_started', { timeout: 5000 });
    expect(fixture.requests.movie).toBe(0);
    fixture.release();
    const body = await (await result).json();
    expect(body.Items.map(item => item.Type)).toEqual(['Movie', 'Movie', 'Audio']);
    expect(fixture.requests).toEqual({ movie: 1, tv: 0, audio: 1 });
    expect((await fetch(`${fixture.origin}/unrecognized`)).status).toBe(400);
    const tv = await (await fetch(`${fixture.origin}/Items?ParentId=scheduler-tv&Limit=1&StartIndex=1`)).json();
    expect(tv.Items.map(item => item.Type)).toEqual(['Series']);
  } finally { await fixture.close(); }
});
test('observer does not invoke scheduler or writer service entrypoints', () => {
  const source = readFileSync(new URL('../../scripts/scheduledInstallationProbe.mjs', import.meta.url), 'utf8');
  expect(source).not.toMatch(/\.syncLibrary\(|\.refillQueue\(|\.processMetadataEnrichmentTask\(|\.schedule\(|\.startWorker\(/);
  expect(source).not.toContain('UPDATE library_ingestion_state');
  expect(source).not.toContain('INSERT INTO task_queue');
});
