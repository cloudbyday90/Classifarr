/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { asUser } from './processes.mjs';
import { runInterruptedRoutingFixture } from './interruptedRoutingFixture.mjs';

let phase = 'guard';
try {
  assert.equal(process.argv.length, 2);
  assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
  const result = await runInterruptedRoutingFixture({ data: async mode => {
    assert(['seed', 'read', 'disable'].includes(mode));
    phase = `data_${mode}`;
    const response = await asUser('classifarr', 'node',
      ['src/scripts/embeddedIsolationDrill/interruptedRoutingDataProbe.mjs', mode]);
    const result = JSON.parse(response.stdout);
    phase = `after_${mode}`;
    return result;
  } });
  process.stdout.write(`PASS interrupted manual routing ${JSON.stringify(result)}\n`);
} catch (error) {
  // Child stdout contains a disposable credential during seed. Never print it.
  const databaseCode = /interrupted_routing_data_probe_failed:([0-9A-Z]{5}|invalid)/.exec(error.stderr ?? '')?.[1] ?? 'none';
  const stages = ['seed', 'login', 'admission', 'crashed', 'committed', 'restarted', 'replay', 'checked', 'observation', 'final_restart', 'cooldown', 'counts'];
  const stage = stages.includes(error.fixtureStage) ? error.fixtureStage : 'unknown';
  const counts = Object.fromEntries(['tmdb', 'movieReads', 'tvReads', 'movieAdds', 'tvAdds', 'healthReads', 'unexpected'].map(key => {
    const value = error.fixtureCounts?.[key];
    return [key, Number.isSafeInteger(value) && value >= 0 && value <= 1000 ? value : null];
  }));
  process.stderr.write(`interrupted_routing_probe_failed:${stage}:${phase}:${databaseCode}:${JSON.stringify(counts)}\n`);
  process.exitCode = 1;
}
