/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as db from '/app/src/config/database.mjs';
import { QueueTaskAcknowledgementService, releaseQueueClaim } from '/app/src/services/queueTaskAcknowledgementService.mjs';
import { createQueueEnrichmentWriteSession } from '/app/src/services/queueEnrichmentWriteSession.mjs';
import { assertFixtureEnvironment, findProcess, poll } from './common.mjs';

await assertFixtureEnvironment();
const mode = process.argv[2];
assert(['arm', 'freeze', 'stale'].includes(mode) && process.argv.length === 3);
const logger = { info() {}, error() {}, warn() {}, debug() {} };
try {
  assert.deepEqual((await db.query('SELECT value FROM shutdown_sentinel')).rows, [{ value: 'preserved' }]);
  if (mode === 'stale') {
    const before = (await db.query('SELECT * FROM task_queue ORDER BY id')).rows;
    const effects = (await db.query('SELECT * FROM queue_drill_effects ORDER BY task_id')).rows;
    const old = (await db.query("SELECT task_id AS id, token AS claim_token, task_type FROM queue_drill_claims WHERE generation='initial' ORDER BY task_id")).rows;
    assert.equal(old.length, 2);
    let receipts = 0;
    const acknowledgement = new QueueTaskAcknowledgementService({ db, logger, receiptService: { recordTerminal() { receipts++; } } });
    for (const task of old) {
      assert.equal(await acknowledgement.complete(task.id, { fixture: 'stale' }, task.claim_token), false);
      assert.equal(await acknowledgement.fail(task.id, 'task_processing_failed', task.claim_token), false);
      assert.equal(await releaseQueueClaim(db, task), false);
      if (task.task_type === 'metadata_enrichment') {
        const session = createQueueEnrichmentWriteSession({ db, task, logger });
        await assert.rejects(session.finish({ fixture: 'stale' }, null, client => client.query(
          'INSERT INTO queue_drill_effects(task_id, token) VALUES ($1,$2)', [task.id, task.claim_token])),
        error => error.reason === 'queue_claim_not_owned');
      }
    }
    assert.equal(receipts, 0);
    assert.deepEqual((await db.query('SELECT * FROM task_queue ORDER BY id')).rows, before);
    assert.deepEqual((await db.query('SELECT * FROM queue_drill_effects ORDER BY task_id')).rows, effects);
  } else {
    const pid = await findProcess('/app/src/index.mjs'); assert(pid);
    process.kill(pid, mode === 'arm' ? 'SIGUSR2' : 'SIGSTOP');
    if (mode === 'freeze') await poll(async () => /^State:\s+T/m.test(await readFile(`/proc/${pid}/status`, 'utf8')));
    else {
      const { rows: [control] } = await db.query('SELECT generation FROM queue_drill_control');
      await poll(async () => {
        let value;
        try { value = JSON.parse(await readFile('/app/data/shutdown-ready.json', 'utf8')); }
        catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return false; throw error; }
        return value.pid === pid && value.generation === control.generation;
      });
    }
  }
  process.stdout.write('queue_fixture_passed\n');
} finally { await db.pool.end(); }
