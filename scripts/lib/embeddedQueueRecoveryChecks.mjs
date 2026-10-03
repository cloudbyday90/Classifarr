/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { withShutdownContainer } from './embeddedShutdownDocker.mjs';

const seed = `CREATE TABLE shutdown_sentinel(value text PRIMARY KEY);
INSERT INTO shutdown_sentinel VALUES ('preserved');
CREATE TABLE queue_drill_control(generation text NOT NULL, finish boolean NOT NULL DEFAULT false);
INSERT INTO queue_drill_control(generation) VALUES ('initial');
CREATE TABLE queue_drill_claims(task_id integer, token uuid, generation text, task_type text,
  PRIMARY KEY(task_id, generation), UNIQUE(token));
CREATE TABLE queue_drill_effects(task_id integer PRIMARY KEY, token uuid NOT NULL);
INSERT INTO task_queue(task_type, payload, next_retry_at) VALUES
  ('metadata_enrichment', '{"shutdownFixture":"v1"}', NOW()+INTERVAL '1 hour'),
  ('classification', '{"shutdownFixture":"v1"}', NOW()+INTERVAL '1 hour');`;

export async function checkQueueRecovery(context, mode) {
  assert(['graceful', 'killed'].includes(mode));
  const { docker, name, image, query, inspect, healthy, offline, waitFor, readReceipt } = context;
  const control = action => docker(['exec', name, 'node', '/app/shutdown-fixture/queueControl.mjs', action]);
  const rows = async () => JSON.parse(await query(`SELECT json_agg(row_to_json(q) ORDER BY id) FROM (
    SELECT id, task_type, status, attempts, claim_token, payload,
      visible_at > clock_timestamp() AS live FROM task_queue) q`));
  const claimed = async generation => {
    try {
      await waitFor(async () => {
        const receipt = JSON.parse(await readReceipt('ready'));
        assert.equal(receipt.phase, undefined, `queue_fixture_failed:${receipt.phase}:${receipt.reason ?? ''}`);
        return await query(`SELECT count(*) FROM queue_drill_claims WHERE generation='${generation}'`) === '2';
      // Classification remains blocked until the normal 60-second recovery sweep.
      }, 90_000);
    } catch (error) {
      const states = (await rows()).map(({ id, status, live }) => ({ id, status, live }));
      throw new Error(`queue_claim_wait_failed:${mode}:${generation}:${JSON.stringify(states)}`, { cause: error });
    }
  };
  await query(seed);
  await control('arm');
  await query('UPDATE task_queue SET next_retry_at=NOW()');
  await claimed('initial');
  const initial = await rows();
  assert.equal(initial.length, 2);
  assert.deepEqual(initial.map(row => row.task_type).sort(), ['classification', 'metadata_enrichment']);
  for (const row of initial) {
    assert.equal(row.status, 'processing'); assert.equal(row.live, true);
    assert.match(row.claim_token, /^[0-9a-f-]{36}$/); assert.equal(row.attempts, 0);
  }
  // Hold pending work across restart until the test-only handlers are installed.
  await query("UPDATE task_queue SET next_retry_at=NOW()+INTERVAL '1 hour'");
  if (mode === 'killed') await control('freeze');
  const seconds = mode === 'killed' ? 10 : 60;
  await docker(['stop', '--timeout', String(seconds), name], (seconds + 10) * 1000);
  const state = await inspect();
  assert.equal(state.Status, 'exited'); assert.equal(state.OOMKilled, false);
  assert.equal(state.ExitCode, mode === 'killed' ? 137 : 0);
  assert.match(await offline(), mode === 'killed' ? /Database cluster state:\s+in production\s*\n/
    : /Database cluster state:\s+shut down\s*\n/);
  await docker(['start', name]); await healthy();
  const restarted = await rows();
  assert.equal(restarted.length, 2);
  for (let index = 0; index < restarted.length; index++) {
    assert.equal(restarted[index].id, initial[index].id);
    assert.equal(restarted[index].attempts, 0);
    assert.equal(restarted[index].status, mode === 'killed' ? 'processing' : 'pending');
    assert.equal(restarted[index].claim_token, mode === 'killed' ? initial[index].claim_token : null);
    if (mode === 'killed') assert.equal(restarted[index].live, true, 'unexpired_claim_must_survive_restart');
  }
  if (mode === 'graceful') await control('stale');
  await query("UPDATE queue_drill_control SET generation='replay'");
  await control('arm');
  // Expire only fixture rows. No production clock/timeout override is introduced.
  await query("UPDATE task_queue SET next_retry_at=NOW(), visible_at=CASE WHEN status='processing' THEN NOW()-INTERVAL '1 second' ELSE visible_at END");
  await claimed('replay');
  const replay = await rows();
  assert.equal(replay.length, 2);
  for (let index = 0; index < replay.length; index++) {
    assert.equal(replay[index].status, 'processing');
    assert.notEqual(replay[index].claim_token, initial[index].claim_token);
    assert.equal(replay[index].live, true);
  }
  await control('stale');
  await query('UPDATE queue_drill_control SET finish=true');
  await waitFor(async () => await query("SELECT count(*) FROM task_queue WHERE status='completed'") === '2', 30_000);
  for (const row of await rows()) {
    assert.equal(row.status, 'completed'); assert.equal(row.claim_token, null);
    assert.equal(row.attempts, 0); assert.deepEqual(row.payload.result, { fixture: 'current' });
  }
  assert.equal(await query(`SELECT count(*) FROM queue_drill_effects e JOIN queue_drill_claims c
    ON c.task_id=e.task_id AND c.token=e.token WHERE c.generation='replay' AND c.task_type='metadata_enrichment'`), '1');
  assert.equal(await query('SELECT count(*) FROM queue_drill_effects'), '1');
  await control('stale');
  assert.equal(await query('SELECT value FROM shutdown_sentinel'), 'preserved');
  await docker(['stop', '--timeout', '60', name], 70_000);
  assert.equal((await inspect()).ExitCode, 0);
  return { mode, image, replayedTasks: 2, staleWritesRejected: true, metadataEffects: 1 };
}

export async function runQueueRecoveryDrill({ container = withShutdownContainer,
  report = value => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const results = [];
  let pinnedImage;
  for (const mode of ['graceful', 'killed']) {
    const result = await container(context => checkQueueRecovery(context, mode),
      { fixtureMode: 'queue', ...(pinnedImage ? { imageName: pinnedImage } : {}) });
    if (pinnedImage) assert.equal(result.image, pinnedImage, 'queue_drill_image_changed');
    pinnedImage = result.image;
    results.push(result); report({ status: 'passed', ...result, cleanup: 'passed' });
  }
  return results;
}
