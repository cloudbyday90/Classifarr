/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { asUser } from './processes.mjs';
import { runQueuedRoutingFixture } from './queuedRoutingFixture.mjs';

try {
  assert.equal(process.argv.length, 2);
  assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
  const result = await runQueuedRoutingFixture({ data: async mode => {
    assert(['seed', 'read', 'disable', 'release-movie', 'release-tv', 'expire-movie', 'expire-tv'].includes(mode));
    const response = await asUser('classifarr', 'node', ['src/scripts/embeddedIsolationDrill/queuedRoutingDataProbe.mjs', mode]);
    return JSON.parse(response.stdout);
  } });
  process.stdout.write(`PASS queued routing ${JSON.stringify(result)}\n`);
} catch (error) {
  const stage = ['seed', 'admission', 'crash', 'reclaim', 'counts'].includes(error.fixtureStage) ? error.fixtureStage : 'unknown';
  const code = /queued_routing_data_probe_failed:([0-9A-Z]{5}|invalid)/.exec(error.stderr ?? '')?.[1] ?? 'none';
  const counts = Object.fromEntries(['tmdb', 'movieReads', 'tvReads', 'movieAdds', 'tvAdds', 'healthReads', 'unexpected'].map(key => {
    const value = error.fixtureCounts?.[key];
    return [key, Number.isSafeInteger(value) && value >= 0 && value <= 1000 ? value : null];
  }));
  process.stderr.write(`queued_routing_probe_failed:${stage}:${code}:${JSON.stringify(counts)}\n`);
  process.exitCode = 1;
}
