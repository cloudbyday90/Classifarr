/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { assertInstallationBudgetEnvironment } from './installationConnectionPressure.mjs';

const directory = '/app/data/upgrade-drill';
const path = `${directory}/unfinished-backfill.json`;
const maxBytes = 512 * 1024;
const id = value => Number.isSafeInteger(value) && value > 0;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function assertBacklogCheckpoint(value) {
  assert.equal(value?.version, 1);
  assert.ok(id(value.ownerPid));
  assert.ok(Number.isFinite(value.databaseEpoch) && value.databaseEpoch > 0);
  assert.equal(value.libraries?.length, 2);
  assert.equal(new Set(value.libraries.map(row => row.library_id)).size, 2);
  assert.ok(value.libraries.every(row => id(row.library_id) && uuid.test(row.run_id)));
  assert.equal(value.inventory?.length, 600);
  assert.equal(value.tasks?.length, 600);
  assert.equal(new Set(value.inventory.map(row => row.id)).size, 600);
  assert.equal(new Set(value.tasks.map(row => row.id)).size, 600);
  for (const library of value.libraries) {
    const items = value.inventory.filter(row => row.library_id === library.library_id);
    assert.equal(items.length, 300);
    assert.ok(items.every(row => id(row.id) && ['movie', 'tv'].includes(row.media_type) &&
      /^restart-(movie|tv)-[0-9]{1,3}$/.test(row.external_id) && row.external_id.startsWith(`restart-${row.media_type}-`)));
    assert.equal(new Set(items.map(row => row.media_type)).size, 1);
    assert.equal(new Set(items.map(row => row.external_id)).size, 300);
  }
  assert.deepEqual([...new Set(value.inventory.map(row => row.media_type))].sort(), ['movie', 'tv']);
  const identity = row => `${row.library_id}:${row.item_id ?? row.id}:${row.media_type}`;
  assert.deepEqual(value.tasks.map(identity).sort(), value.inventory.map(identity).sort());
  const processing = value.tasks.filter(row => row.status === 'processing');
  assert.ok(processing.length > 0 && processing.length < 600);
  assert.ok(value.tasks.some(row => row.status === 'pending'));
  for (const row of value.tasks) {
    assert.ok(id(row.id));
    assert.equal(row.task_type, 'metadata_enrichment');
    assert.equal(row.attempts, 0);
    assert.equal(row.completions, 0);
    assert.ok(['pending', 'processing'].includes(row.status));
    assert.equal(row.starts, row.status === 'processing' ? 1 : 0);
    if (row.status === 'processing') {
      assert.equal(row.media_type, 'movie');
      assert.ok(Number.isFinite(row.started_ms) && row.started_ms > 0);
      assert.equal(row.visible_ms - row.started_ms, 600000);
    } else {
      assert.equal(row.started_ms, null);
      assert.equal(row.visible_ms, null);
    }
  }
  return value;
}

async function flushAndClose(handle, text) {
  try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
}

export async function writeBacklogCheckpoint(value) {
  assertInstallationBudgetEnvironment();
  const text = JSON.stringify(assertBacklogCheckpoint(value));
  assert.ok(Buffer.byteLength(text) <= maxBytes);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await flushAndClose(await open(path, 'wx', 0o600), text);
  await flushAndClose(await open(`${directory}/unfinished-backfill-ready`, 'wx', 0o600), 'ready');
}

export async function readBacklogCheckpoint() {
  assertInstallationBudgetEnvironment();
  assert.ok((await stat(path)).size <= maxBytes);
  return assertBacklogCheckpoint(JSON.parse(await readFile(path, 'utf8')));
}
