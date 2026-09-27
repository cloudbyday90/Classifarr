/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { jest } from '@jest/globals';
import { createNamedMockModule, createTransactionalDbMock } from './helpers/mockFactory.mjs';

const database = createTransactionalDbMock();
const patterns = { listAll: jest.fn() };
const evidence = { listAll: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', database));
jest.unstable_mockModule('../services/learningPatternEvidenceAdapter.mjs', () =>
  createNamedMockModule('learningPatternEvidenceAdapter', patterns));
jest.unstable_mockModule('../services/classificationEvidenceRepository.mjs', () =>
  createNamedMockModule('classificationEvidenceRepository', evidence));
const { collectBackupSnapshot } = await import('../services/backupSnapshot.mjs');

describe('configuration backup snapshot', () => {
  let client;
  beforeEach(() => {
    database.query.mockReset();
    database.pool.connect.mockReset();
    database.withTransaction.mockClear();
    patterns.listAll.mockReset();
    evidence.listAll.mockReset();
    client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    database.pool.connect.mockResolvedValue(client);
    patterns.listAll.mockResolvedValue([{ id: 42 }]);
    evidence.listAll.mockResolvedValue([{ id: 43 }]);
  });

  it('uses one bounded read-only transaction for every section and evidence reader', async () => {
    const backup = await collectBackupSnapshot();
    const sql = client.query.mock.calls.map(([statement]) => statement);
    expect(sql.slice(0, 6)).toEqual([
      'BEGIN',
      'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      "SET LOCAL lock_timeout = '5s'",
      "SET LOCAL statement_timeout = '30s'",
      "SET LOCAL idle_in_transaction_session_timeout = '10s'",
      "SET LOCAL transaction_timeout = '120s'",
    ]);
    expect(sql.filter(statement => statement.startsWith('SELECT'))).toHaveLength(32);
    expect(sql.at(-1)).toBe('COMMIT');
    expect(database.query).not.toHaveBeenCalled();
    expect(database.pool.connect).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(patterns.listAll).toHaveBeenCalledWith({ client });
    expect(evidence.listAll).toHaveBeenCalledWith({ client });
    expect(backup.version).toBe('2.0');
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
    expect(backup.data.learningPatterns).toEqual([{ id: 42 }]);
    expect(backup.meta.classificationEvidenceCount).toBe(1);
  });

  it('preserves selected user fields, singleton shape and legacy counts without optional reads', async () => {
    client.query.mockImplementation(async sql => {
      if (sql.includes('FROM users')) return { rows: [{ id: 7, username: 'test' }] };
      if (sql.includes('FROM ollama_config')) return { rows: [{ id: 1 }] };
      return { rows: [] };
    });
    const backup = await collectBackupSnapshot({ includePatterns: false });
    expect(backup.data.users).toEqual([{ id: 7, username: 'test', password_hash: '<excluded>' }]);
    expect(client.query.mock.calls.find(([sql]) => sql.includes('FROM users'))[0]).not.toContain('password_hash');
    expect(backup.data.ollamaConfig).toEqual({ id: 1 });
    expect(backup.data.webhookConfig).toBeNull();
    expect(backup.meta).toMatchObject({ usersCount: 1, librariesCount: 0, policiesCount: 0 });
    expect(backup.data).not.toHaveProperty('classificationEvidence');
    expect(backup.meta).not.toHaveProperty('learningPatternsCount');
    expect(patterns.listAll).not.toHaveBeenCalled();
    expect(evidence.listAll).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith(
      'SELECT * FROM auto_learned_preferences WHERE status = $1 ORDER BY id', ['active'],
    );
  });

  it.each(['configuration', 'patterns', 'evidence', 'commit'])('rolls back and releases on %s failure', async stage => {
    const failure = new Error('snapshot failed');
    client.query.mockImplementation(async sql => {
      if ((stage === 'configuration' && sql.includes('FROM libraries')) ||
          (stage === 'commit' && sql === 'COMMIT')) throw failure;
      return { rows: [] };
    });
    if (stage === 'patterns') patterns.listAll.mockRejectedValueOnce(failure);
    if (stage === 'evidence') evidence.listAll.mockRejectedValueOnce(failure);
    await expect(collectBackupSnapshot()).rejects.toBe(failure);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
    if (stage === 'configuration') {
      expect(client.query.mock.calls.some(([sql]) => sql.includes('FROM library_policies'))).toBe(false);
      expect(patterns.listAll).not.toHaveBeenCalled();
    }
  });
});
