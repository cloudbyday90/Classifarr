/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createPublicationFixture, publicationQuery as query, publicationSnapshot as snapshot,
  publicationDeferred as deferred, untilPublication as until } from './helpers/sourcePairPublicationFixture.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL } from '../../services/adjudicationBudgetSql.mjs';
import { SAVE_SOURCE_PAIR_SQL } from '../../services/automaticSourcePairSql.mjs';

beforeEach(async () => {
  await query('TRUNCATE adjudication_capture_budget,cached_adjudication_batch,automatic_source_pair_evaluation,automatic_evaluation_history,automatic_source_pair_sweep');
});

test('capture checkpoint creation excludes evaluator publication; a later evaluator preserves unpublished progress', async () => {
  const f = await createPublicationFixture(), locked = deferred(), release = deferred(); let capture;
  f.captureIo.control.query = async (native, args) => {
    const result = await native(...args);
    if (args[0] === LOCK_OWNED_ADJUDICATION_BUDGET_SQL) { locked.resolve(); await release.promise; }
    return result;
  };
  try {
    capture = f.captureAdmission((signal, _checkpoint, owner) => f.openCheckpoint(signal, owner));
    await Promise.race([locked.promise, capture.then(() => { throw Error('checkpoint_lock_not_observed'); })]);
    expect(await f.worker.run()).toEqual({ status: 'deferred', reason: 'busy' });
    expect(f.repository.readSnapshot).not.toHaveBeenCalled(); expect(f.evaluate).not.toHaveBeenCalled();
    expect(f.repository.save).not.toHaveBeenCalled();
    expect((await snapshot()).budget[0].progress).toBeNull();
    release.resolve(); await capture;
    const retained = await snapshot();
    expect(retained.budget[0]).toMatchObject({ calls_reserved: 1, tokens_reserved: 8448,
      published_fingerprint: null, revision: f.state.revision, selection_offset: 0 });
    expect(retained.budget[0].progress).not.toBeNull();
    await query(`UPDATE automatic_source_pair_evaluation SET observed_at=statement_timestamp()-interval '10 minutes',
      next_check_at=statement_timestamp()-interval '1 minute'`);
    expect(await f.worker.run()).toEqual({ status: 'evaluated' });
    expect(f.repository.save).toHaveBeenCalledTimes(1); expect(f.evaluate).toHaveBeenCalledTimes(1);
    expect(f.repository.save.mock.calls[0][4].replayWindow).toEqual({ revision: f.state.revision, selectionOffset: 0, nextOffset: 25 });
    expect(await snapshot()).toEqual(retained);
    expect((await query('SELECT status FROM automatic_source_pair_evaluation')).rows).toEqual([{ status: 'complete' }]);
  } finally { release.resolve(); await Promise.allSettled([capture]); await f.close(); }
});

test.each(['queued', 'commit', 'rollback', 'lost_ack'])('evaluation keeps capture excluded through %s publication settlement', async mode => {
  const f = await createPublicationFixture(), queued = deferred(), written = deferred(), releaseWrite = deferred();
  const settled = deferred(), releaseReply = deferred(), held = []; let running, saveStarted = false, settlementObserved = false;
  const contender = jest.fn();
  const blocked = async () => {
    await expect(f.captureAdmission(contender)).rejects.toMatchObject({ reason: 'busy' });
    expect(contender).not.toHaveBeenCalled();
    const permit = f.evaluationResources.tryAcquire('discovery');
    try { expect(permit.allowed).toBe(false); expect(permit.reason).toBe('busy'); } finally { permit.release?.(); }
  };
  try {
    await f.captureAdmission((signal, _checkpoint, owner) => f.openCheckpoint(signal, owner));
    const retained = await snapshot(); f.captureIo.queries.length = 0;
    if (mode === 'queued') f.repository.save.mockImplementation(async (...args) => {
      // Evaluator and discovery sessions occupy two slots; hold the remaining write capacity.
      held.push(await f.db.pool.connect(), await f.db.pool.connect()); queued.resolve();
      return f.saveReport(...args);
    });
    f.evaluationIo.control.query = async (native, args) => {
      const result = await native(...args);
      if (args[0] === SAVE_SOURCE_PAIR_SQL) {
        saveStarted = true; written.resolve(); await releaseWrite.promise;
        if (mode === 'rollback') throw Error('synthetic_publication_write_failure');
      }
      if (saveStarted && !settlementObserved && args[0] === (mode === 'rollback' ? 'ROLLBACK' : 'COMMIT')) {
        settlementObserved = true; settled.resolve(); await releaseReply.promise;
        if (mode === 'lost_ack') throw Error('synthetic_lost_publication_acknowledgement');
      }
      return result;
    };
    running = f.worker.run();
    if (mode === 'queued') {
      await Promise.race([queued.promise, running.then(() => { throw Error('publication_queue_not_observed'); })]);
      await until(() => f.db.pool.waitingCount === 1); await blocked();
      for (const client of held.splice(0)) client.release();
    }
    await Promise.race([written.promise, running.then(() => { throw Error('publication_write_not_observed'); })]);
    await blocked(); expect(await snapshot()).toEqual(retained);
    expect((await query('SELECT * FROM automatic_source_pair_evaluation')).rows).toEqual([]);
    releaseWrite.resolve();
    await Promise.race([settled.promise, running.then(() => { throw Error('publication_settlement_not_observed'); })]);
    await blocked(); expect(await snapshot()).toEqual(retained);
    // The observer sees actual durability before the original command acknowledgement is delivered.
    expect((await query('SELECT status FROM automatic_source_pair_evaluation')).rows)
      .toEqual(mode === 'rollback' ? [] : [{ status: 'complete' }]);
    releaseReply.resolve();
    expect(await running).toMatchObject({ status: ['rollback', 'lost_ack'].includes(mode) ? 'failed' : 'evaluated' });
    expect(f.repository.save).toHaveBeenCalledTimes(1);
    expect(f.evaluationIo.queries.filter(([sql]) => sql === SAVE_SOURCE_PAIR_SQL)).toHaveLength(1);
    expect(f.repository.fail).toHaveBeenCalledTimes(['rollback', 'lost_ack'].includes(mode) ? 1 : 0);
    expect(await snapshot()).toEqual(retained);
    expect(f.captureIo.queries.some(([sql]) => sql === LOCK_OWNED_ADJUDICATION_BUDGET_SQL)).toBe(false);
    expect(await f.captureAdmission(contender)).toBeUndefined(); expect(contender).toHaveBeenCalledTimes(1);
  } finally {
    for (const client of held.splice(0)) client.release();
    releaseWrite.resolve(); releaseReply.resolve();
    await Promise.allSettled([running]); await f.close();
  }
});
