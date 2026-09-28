/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';

export const SCHEDULED_CRASH_CHECKPOINT = '/app/data/upgrade-drill/scheduled-backfill.json';

export function validateScheduledCrashCheckpoint(value) {
  assert.equal(value?.version, 1);
  assert.ok(Number.isSafeInteger(value.ownerPid) && value.ownerPid > 0);
  assert.equal(value.libraries?.length, 2);
  assert.equal(new Set(value.libraries.map(row => row.library_id)).size, 2);
  for (const row of value.libraries) {
    assert.ok(Number.isSafeInteger(row.library_id) && row.library_id > 0);
    assert.match(row.run_id, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  }
  assert.equal(value.inventory?.length, 4);
  assert.equal(new Set(value.inventory.map(row => row.id)).size, 4);
  assert.deepEqual(value.inventory.map(row => row.media_type).sort(), ['movie', 'movie', 'tv', 'tv']);
  for (const row of value.inventory) {
    assert.ok(Number.isSafeInteger(row.id) && row.id > 0);
    assert.ok(value.libraries.some(library => library.library_id === row.library_id));
    assert.match(row.external_id, /^scheduler-(movie|tv)-[01]$/);
  }
  return value;
}

export async function writeScheduledCrashCheckpoint(value) {
  assertUpgradeDrillEnvironment();
  validateScheduledCrashCheckpoint(value);
  await mkdir('/app/data/upgrade-drill', { recursive: true, mode: 0o700 });
  const file = await open(SCHEDULED_CRASH_CHECKPOINT, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(value)); await file.sync(); }
  finally { await file.close(); }
  // Publish readiness only after the complete checkpoint is flushed and closed.
  await writeFile('/app/data/upgrade-drill/scheduled-backfill-ready', 'ready', { flag: 'wx', mode: 0o600 });
}

export async function readScheduledCrashCheckpoint() {
  assertUpgradeDrillEnvironment();
  const file = await open(SCHEDULED_CRASH_CHECKPOINT, 'r');
  try {
    assert.ok((await file.stat()).size <= 4096);
    return validateScheduledCrashCheckpoint(JSON.parse(await file.readFile('utf8')));
  } finally { await file.close(); }
}
