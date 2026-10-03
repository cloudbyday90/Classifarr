/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

export async function assertFixtureEnvironment() {
  assert.equal(process.env.CLASSIFARR_SHUTDOWN_DRILL, 'disposable-v1');
  assert.equal(process.platform, 'linux');
  assert.equal(process.getuid(), 1000);
  assert.deepEqual(await readdir('/sys/class/net'), ['lo']);
  const mounts = await readFile('/proc/self/mountinfo', 'utf8');
  for (const path of ['/app/data', '/app/shutdown-fixture']) {
    assert(mounts.split('\n').some(line => line.split(' ')[4] === path));
  }
}

export async function poll(check, timeout = 15_000) {
  const deadline = performance.now() + timeout;
  do {
    const result = await check();
    if (result) return result;
    await sleep(20);
  } while (performance.now() < deadline);
  throw new Error('shutdown_fixture_wait_timeout');
}

export async function findProcess(script) {
  const matches = [];
  for (const id of await readdir('/proc')) {
    if (!/^\d+$/.test(id)) continue;
    try {
      const args = (await readFile(`/proc/${id}/cmdline`, 'utf8')).split('\0');
      if (args[1] === script) matches.push(Number(id));
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error; }
  }
  assert(matches.length <= 1, 'ambiguous_fixture_process');
  return matches[0];
}

export async function receipt(name, value) {
  assert(['ready', 'signal', 'http', 'failure'].includes(name));
  await writeFile(`/app/data/shutdown-${name}.json`, JSON.stringify(value));
}
