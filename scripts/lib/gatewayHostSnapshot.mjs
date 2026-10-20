/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runDockerCheckCommand, DOCKER_CHECK_OUTPUT_LIMIT } from './dockerCheckCommand.mjs';

const idPattern = /^[a-f0-9]{64}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const states = new Set(['created', 'running', 'paused', 'restarting', 'removing', 'exited', 'dead']);
const inventoryArgs = ['ps', '-aq', '--no-trunc'];
const daemonArgs = ['info', '--format', '{{json .ID}}'];
const lifecycleTemplate = '[{{json .Id}},{{json .State.Status}},{{json .State.StartedAt}},{{json .State.FinishedAt}},{{json .RestartCount}}]';

function inventory(raw) {
  const ids = raw.trim() ? raw.trim().split(/\r?\n/) : [];
  assert.ok(ids.length <= 128 && ids.every(id => idPattern.test(id)) && new Set(ids).size === ids.length);
  return ids.sort();
}

function daemon(raw) {
  const value = JSON.parse(raw);
  assert.ok(typeof value === 'string' && /^[A-Za-z0-9:-]{1,128}$/.test(value));
  return value;
}

function timestamp(value) {
  assert.ok(typeof value === 'string' && timestampPattern.test(value) && Number.isFinite(Date.parse(value)));
  // Date.parse normalizes invalid days; refuse these rather than silently repairing evidence.
  assert.equal(new Date(Date.parse(value)).toISOString().slice(0, 19), value.slice(0, 19));
}

/** Bounded endpoint observation, not continuous monitoring or proof of host idleness. */
export function captureGatewayHostSnapshot({ command = runDockerCheckCommand, now = () => performance.now() } = {}) {
  try {
    const deadline = now() + 5000;
    const read = args => {
      const remaining = deadline - now();
      assert.ok(remaining >= 1);
      const value = command(args, { timeoutMs: Math.floor(remaining) });
      assert.ok(value?.ok && !value.timedOut && !value.outputLimited && value.exitCode === 0);
      assert.ok(typeof value.stdout === 'string' && Buffer.byteLength(value.stdout) < DOCKER_CHECK_OUTPUT_LIMIT);
      assert.ok(now() <= deadline);
      return value.stdout;
    };
    const daemonId = daemon(read(daemonArgs));
    const ids = inventory(read(inventoryArgs));
    const rows = ids.length ? read(['inspect', '--type', 'container', '--format', lifecycleTemplate, ...ids])
      .trim().split(/\r?\n/).map(line => JSON.parse(line)) : [];
    assert.equal(rows.length, ids.length);
    for (const row of rows) {
      assert.ok(Array.isArray(row) && row.length === 5 && idPattern.test(row[0]) && states.has(row[1]));
      timestamp(row[2]); timestamp(row[3]);
      assert.ok(Number.isSafeInteger(row[4]) && row[4] >= 0);
    }
    rows.sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(rows.map(row => row[0]), ids);
    assert.deepEqual(inventory(read(inventoryArgs)), ids);
    assert.equal(daemon(read(daemonArgs)), daemonId);
    return { containers: ids.length, sha256: createHash('sha256').update(JSON.stringify([daemonId, rows])).digest('hex') };
  } catch {
    // Raw command output and assertion values can contain sensitive host data.
    throw new Error('gateway_host_snapshot_unavailable');
  }
}
