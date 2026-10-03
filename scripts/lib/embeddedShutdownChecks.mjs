/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { withShutdownContainer } from './embeddedShutdownDocker.mjs';

export const SHUTDOWN_CASES = Object.freeze([
  { mode: 'drain', seconds: 10, exit: 0, clean: true },
  { mode: 'drain', seconds: 60, exit: 0, clean: true },
  { mode: 'frozen', seconds: 10, exit: 137, clean: false },
  { mode: 'frozen', seconds: 60, exit: 1, clean: true },
].map(Object.freeze));

export async function checkLoadedShutdown(context, scenario) {
  assert(SHUTDOWN_CASES.includes(scenario), 'unsupported_shutdown_scenario');
  const { docker, name, image, inspect, query, healthy, readReceipt, waitFor, offline } = context;
  await query("CREATE TABLE shutdown_sentinel(value text PRIMARY KEY); INSERT INTO shutdown_sentinel VALUES ('preserved'); INSERT INTO users (username, password_hash, role, is_active) VALUES ('shutdown-drill', 'disabled-fixture-no-login', 'user', false)");
  await docker(['exec', '--detach', name, 'node', '/app/shutdown-fixture/workload.mjs', scenario.mode]);
  const ready = await waitFor(async () => {
    const text = await readReceipt('ready');
    if (!text) return false;
    let value;
    try { value = JSON.parse(text); } catch (error) { if (error instanceof SyntaxError) return false; throw error; }
    assert.equal(value.phase, undefined, `shutdown_fixture_failed:${value.phase}:${value.reason ?? ''}`);
    return value;
  }, 30_000);
  assert.equal(ready.mode, scenario.mode);
  for (const key of ['httpBlocked', 'assessmentBlocked', 'uncommitted']) assert.equal(ready[key], true);
  for (const key of ['application', 'worker']) assert(Number.isSafeInteger(ready[key]) && ready[key] > 1);
  const started = performance.now();
  await docker(['stop', '--timeout', String(scenario.seconds), name], (scenario.seconds + 10) * 1000);
  const stopMs = Math.round(performance.now() - started);
  const state = await inspect();
  assert.equal(state.Status, 'exited'); assert.equal(state.OOMKilled, false);
  assert.equal(state.ExitCode, scenario.exit);
  const log = await docker(['logs', name]);
  assert.match(log, /"component":"EmbeddedQueueMaintenance","status":"assessment_started"/);
  if (scenario.clean) {
    const workerStopped = log.indexOf('"component":"EmbeddedQueueMaintenance","status":"unavailable"');
    const appStopped = log.indexOf('"status":"application_stopped"');
    const dbStopped = log.indexOf('"status":"database_stopped"');
    assert(workerStopped >= 0 && appStopped >= 0 && dbStopped > Math.max(workerStopped, appStopped), 'shutdown_order_unconfirmed');
  } else assert.doesNotMatch(log, /"status":"database_stopped"/);
  const control = await offline();
  assert.match(control, scenario.clean ? /Database cluster state:\s+shut down\s*\n/
    : /Database cluster state:\s+in production\s*\n/);
  await docker(['start', name]);
  await healthy();
  assert.equal(await query('SELECT value FROM shutdown_sentinel ORDER BY value'), 'preserved');
  assert.equal(await query('SELECT attempts FROM queue_vacuum_recovery_state WHERE singleton'), '0');
  assert.equal(await query('SELECT count(*) FROM libraries'), '0');
  const postgresLog = await docker(['exec', name, 'cat', '/app/data/postgres.log']);
  const recovery = /database system was interrupted|automatic recovery in progress/i;
  if (scenario.clean) assert.doesNotMatch(postgresLog, recovery);
  else assert.match(postgresLog, recovery);
  if (scenario.mode === 'drain') {
    assert.deepEqual(JSON.parse(await readReceipt('http')), { status: 200, completedAfterSignal: true });
  }
  const processes = await docker(['exec', name, 'ps', '-o', 'pid,args']);
  assert.doesNotMatch(processes, /runCompatibleQueueRecovery.mjs/);
  assert.match(processes, /\/app\/src\/index.mjs/);
  await docker(['stop', '--timeout', '60', name], 70_000);
  assert.equal((await inspect()).ExitCode, 0);
  return { mode: scenario.mode, hostTimeoutSeconds: scenario.seconds, exitCode: scenario.exit,
    databaseClean: scenario.clean, stopMs, image, dataPreserved: true };
}

export async function runLoadedShutdownDrill({ container = withShutdownContainer,
  report = value => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const results = [];
  let pinnedImage;
  for (const scenario of SHUTDOWN_CASES) {
    const result = await container(context => checkLoadedShutdown(context, scenario), pinnedImage ? { imageName: pinnedImage } : undefined);
    if (pinnedImage) assert.equal(result.image, pinnedImage, 'shutdown_drill_image_changed');
    pinnedImage = result.image;
    results.push(result);
    report({ status: 'passed', ...result, cleanup: 'passed' });
  }
  return results;
}
