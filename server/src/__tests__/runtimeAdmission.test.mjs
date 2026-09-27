/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import { acquireNormalRuntimeAdmission } from '../bootstrap/runtimeAdmission.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';

function setup() {
  const client = Object.assign(new EventEmitter(), { query: jest.fn(), release: jest.fn() });
  client.query.mockResolvedValueOnce({ rows: [{ acquired: true }] })
    .mockResolvedValueOnce({ rows: [{ gate_table: 'gate' }] })
    .mockResolvedValueOnce({ rows: [{ gate_state: 'ready' }] });
  const database = { pool: { connect: jest.fn().mockResolvedValue(client) } };
  const onLost = jest.fn();
  return { client, database, onLost, acquire: () => acquireNormalRuntimeAdmission({ database, onLost }) };
}

test('holds shared admission until explicit process-exit cleanup', async () => {
  const { acquire, client, onLost } = setup();
  const admission = await acquire();
  expect(client.query.mock.calls[0]).toEqual(['SELECT pg_try_advisory_lock_shared($1) AS acquired', [RUNTIME_MAINTENANCE_LOCK_KEY]]);
  expect(client.release).not.toHaveBeenCalled();
  admission.assertHealthy();
  admission.release();
  admission.release();
  expect(client.release).toHaveBeenCalledTimes(1);
  expect(client.release).toHaveBeenCalledWith(true);
  expect(() => admission.assertHealthy()).toThrow('admission_lost');
  client.emit('end');
  expect(onLost).not.toHaveBeenCalled();
  expect(client.listenerCount('error')).toBe(0);
});

test.each([false, null, undefined, 'true'])('fails closed on unconfirmed admission %s', async acquired => {
  const { acquire, client } = setup();
  client.query.mockReset().mockResolvedValueOnce({ rows: [{ acquired }] });
  await expect(acquire()).rejects.toThrow('Normal startup is blocked');
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.release).toHaveBeenCalledWith(true);
});

test.each(['restore_in_progress', 'requires_maintenance', undefined, 'unknown'])('refuses gate %s before any repairs', async state => {
  const { acquire, client } = setup();
  client.query.mockReset().mockResolvedValueOnce({ rows: [{ acquired: true }] })
    .mockResolvedValueOnce({ rows: [{ gate_table: 'gate' }] })
    .mockResolvedValueOnce({ rows: state ? [{ gate_state: state }] : [] });
  await expect(acquire()).rejects.toThrow('Restore verification is incomplete');
  expect(client.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  expect(client.release).toHaveBeenCalledWith(true);
});

test('allows fresh schema initialization when no restore gate exists', async () => {
  const { acquire, client } = setup();
  client.query.mockReset().mockResolvedValueOnce({ rows: [{ acquired: true }] }).mockResolvedValueOnce({ rows: [] });
  const admission = await acquire();
  expect(client.query).toHaveBeenCalledTimes(2);
  admission.release();
});

test.each(['error', 'end'])('loss via %s invokes fail-stop once without reconnecting', async event => {
  const { acquire, client, database, onLost } = setup();
  const admission = await acquire();
  client.emit(event, new Error('lost connection'));
  client.emit('end');
  expect(onLost).toHaveBeenCalledTimes(1);
  expect(() => admission.assertHealthy()).toThrow();
  expect(database.pool.connect).toHaveBeenCalledTimes(1);
  admission.release();
});

test('loss during admission never returns a usable handle', async () => {
  const { acquire, client, onLost } = setup();
  client.query.mockReset().mockImplementation(async () => {
    client.emit('end');
    return { rows: [{ acquired: true }] };
  });
  await expect(acquire()).rejects.toThrow('admission_lost');
  expect(onLost).toHaveBeenCalledTimes(1);
  expect(client.release).toHaveBeenCalledWith(true);
});

test('query failure destroys admission without importing startup', async () => {
  const { acquire, client } = setup();
  client.query.mockReset().mockRejectedValue(new Error('query failed'));
  await expect(acquire()).rejects.toThrow('query failed');
  expect(client.release).toHaveBeenCalledWith(true);
});

test('rejects a pool too small to hold admission and serve normal queries', async () => {
  const { acquire, database } = setup();
  database.pool.options = { max: 1 };
  await expect(acquire()).rejects.toThrow('POSTGRES_POOL_MAX of at least 2');
  expect(database.pool.connect).not.toHaveBeenCalled();
});
