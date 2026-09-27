/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import { withBackupRestoreSession } from '../../services/backupRestoreSession.mjs';
import {
  BACKUP_RESTORE_SESSION_LOCK_KEY,
  BACKUP_RESTORE_SESSION_OWNER_REASON,
} from '../../utils/backupRestoreSessionContract.mjs';
import {
  beginNativeIntentReconciliationRestore,
} from '../../services/nativeIntentReconciliationLifecyclePersistence.mjs';
import { buildReconciliationExecutionEligibility } from '../../services/nativeIntentReconciliationLifecycleContract.mjs';

function setup() {
  const client = Object.assign(new EventEmitter(), {
    query: jest.fn(async sql => ({ rows: sql.includes('pg_try_advisory_lock') ? [{ acquired: true }] : [] })),
    release: jest.fn(),
  });
  const database = { pool: { connect: jest.fn().mockResolvedValue(client) } };
  const logger = { warn: jest.fn() };
  return { client, database, logger, run: callback => withBackupRestoreSession({ database, logger }, callback) };
}

describe('pinned backup restore ownership', () => {
  test('locks before recovery and uses one connection through both transactions', async () => {
    const { client, database, run } = setup();
    await expect(run(async db => {
      await db.query('begin gate');
      await db.withTransaction(tx => tx.query('restore configuration'));
      await db.query('verify');
      await db.withTransaction(tx => tx.query('complete and receipt'));
      return 'verified';
    })).resolves.toBe('verified');
    expect(database.pool.connect).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0]).toEqual([
      'SELECT pg_try_advisory_lock($1) AS acquired', [BACKUP_RESTORE_SESSION_LOCK_KEY],
    ]);
    expect(client.query.mock.calls[1]).toEqual([
      expect.stringContaining("gate_state = 'requires_maintenance'"), [BACKUP_RESTORE_SESSION_OWNER_REASON],
    ]);
    expect(client.query.mock.calls[1][0]).toContain("gate_state = 'restore_in_progress' AND reason_id = $1");
    expect(client.query.mock.calls.slice(2).map(([sql]) => sql)).toEqual([
      'begin gate', 'BEGIN', 'restore configuration', 'COMMIT', 'verify',
      'BEGIN', 'complete and receipt', 'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  test.each([false, null, undefined, 'true'])('refuses unconfirmed acquisition (%s) before any writes', async acquired => {
    const { client, run } = setup();
    client.query.mockResolvedValueOnce({ rows: [{ acquired }] });
    const work = jest.fn();
    await expect(run(work)).rejects.toThrow('already in progress');
    expect(work).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  test('connection acquisition failure invokes no work', async () => {
    const { database, client, run } = setup();
    const error = new Error('connection unavailable');
    database.pool.connect.mockRejectedValueOnce(error);
    const work = jest.fn();
    await expect(run(work)).rejects.toBe(error);
    expect(work).not.toHaveBeenCalled();
    expect(client.release).not.toHaveBeenCalled();
  });

  test.each([1, 2])('SQL failure during acquisition/recovery (%s) destroys the session', async failureCall => {
    const { client, run } = setup();
    const error = new Error('database failure');
    client.query.mockImplementation(async () => {
      if (client.query.mock.calls.length === failureCall) throw error;
      return { rows: [{ acquired: true }] };
    });
    const work = jest.fn();
    await expect(run(work)).rejects.toBe(error);
    expect(work).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
  });

  test('rolls back a rejected transaction and allows token-bound failure recording', async () => {
    const { client, run } = setup();
    const error = new Error('restore validation failed');
    await run(async db => {
      await expect(db.withTransaction(async tx => { await tx.query('write'); throw error; })).rejects.toBe(error);
      await db.query('record failure');
    });
    expect(client.query.mock.calls.slice(2).map(([sql]) => sql)).toEqual(['BEGIN', 'write', 'ROLLBACK', 'record failure']);
  });

  test.each(['BEGIN', 'COMMIT', 'ROLLBACK'])('does not replay after %s fails', async command => {
    const { client, run } = setup();
    const error = new Error('original failure');
    const defaultQuery = client.query.getMockImplementation();
    client.query.mockImplementation(async sql => {
      if (sql === command) throw error;
      return defaultQuery(sql);
    });
    await run(async db => {
      await expect(db.withTransaction(async () => {
        if (command === 'ROLLBACK') throw error;
      })).rejects.toBe(error);
      if (command !== 'BEGIN') await expect(db.query('must not replay')).rejects.toBe(error);
    }).catch(received => expect(received).toBe(error));
    expect(client.query.mock.calls.filter(([sql]) => sql === command)).toHaveLength(1);
    expect(client.query.mock.calls.some(([sql]) => sql === 'must not replay')).toBe(false);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  test('cannot start nested transactions', async () => {
    const { run } = setup();
    await run(db => db.withTransaction(async () => {
      await expect(db.withTransaction(jest.fn())).rejects.toThrow('already_active');
    }));
  });

  test('rejects escaped transaction queries even while the owning session is open', async () => {
    const { run } = setup();
    await run(async db => {
      let escaped;
      await db.withTransaction(async tx => { escaped = tx; });
      await expect(escaped.query('late write')).rejects.toThrow('transaction_closed');
    });
  });

  test('rejects escaped session queries and transactions after its callback settles', async () => {
    const { client, run } = setup();
    let escaped;
    await run(async db => { escaped = db; });
    await expect(escaped.query('late write')).rejects.toThrow('session_closed');
    await expect(escaped.withTransaction(jest.fn())).rejects.toThrow('session_closed');
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  test('destroys an unawaited transaction and prevents its later commit', async () => {
    const { client, run } = setup();
    const ready = Promise.withResolvers();
    const resume = Promise.withResolvers();
    let outcome;
    await expect(run(async db => {
      outcome = db.withTransaction(async () => { ready.resolve(); await resume.promise; })
        .catch(error => error);
      await ready.promise;
    })).rejects.toThrow('not_awaited');
    resume.resolve();
    expect(await outcome).toEqual(expect.objectContaining({ message: 'backup_restore_session_closed' }));
    expect(client.query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  test.each(['before write', 'after write', 'before commit', 'after commit'])('fences connection loss %s', async phase => {
    const { client, logger, run } = setup();
    const error = Object.assign(new Error('lost session'), { code: '57P01' });
    const defaultQuery = client.query.getMockImplementation();
    client.query.mockImplementation(async sql => {
      const result = await defaultQuery(sql);
      if ((phase === 'after write' && sql === 'write') || (phase === 'after commit' && sql === 'COMMIT')) {
        client.emit('error', error);
      }
      return result;
    });
    await expect(run(db => db.withTransaction(async tx => {
      if (phase === 'before write') client.emit('error', error);
      await tx.query('write');
      if (phase === 'before commit') client.emit('error', error);
    }))).rejects.toBe(error);
    expect(client.query.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(phase === 'after commit' ? 1 : 0);
    expect(client.query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(false);
    expect(client.release).toHaveBeenCalledWith(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String),
      { operation: 'backup_restore', code: '57P01' }, { skipDbPersist: true });
  });

  test.each([false, true, 'true'])('only explicit protocol opt-in marks a new gate (%s)', async sessionOwned => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ gate_state: 'restore_in_progress' }] }) };
    await beginNativeIntentReconciliationRestore({ db, restoreToken: 'token', startedAt: 'time', sessionOwned });
    expect(db.query.mock.calls[0][1]).toEqual(['token', 'time',
      sessionOwned === true ? BACKUP_RESTORE_SESSION_OWNER_REASON : 'restore_in_progress']);
  });

  test('public execution eligibility keeps the existing in-progress reason', () => {
    expect(buildReconciliationExecutionEligibility({
      gate_state: 'restore_in_progress', reason_id: BACKUP_RESTORE_SESSION_OWNER_REASON,
    })).toEqual(expect.objectContaining({ allowed: false, reasonId: 'restore_in_progress' }));
  });
});
