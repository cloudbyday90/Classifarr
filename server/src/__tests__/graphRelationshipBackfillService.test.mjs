/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const db = { query: jest.fn() };
const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...db,
  default: db,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { checkAndBackfill } = await import('../services/graphRelationshipBackfillService.mjs');

let backfill;
let savedEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  delete process.env.TMDB_API_KEY;
  delete process.env.TMDB_READ_ACCESS_TOKEN;

  db.query.mockReset();
  logger.info.mockReset();
  logger.warn.mockReset();
  logger.error.mockReset();
  logger.debug.mockReset();

  backfill = {
    runPass1: jest.fn().mockResolvedValue(),
    runPass2: jest.fn().mockResolvedValue(),
  };
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('Pass 1 (metadata extraction)', () => {
  test('starts background runPass1 when count > 0', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ cnt: '5' }] });

    await checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 });

    expect(backfill.runPass1).toHaveBeenCalled();
  });

  test('skips runPass1 when count is 0', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });

    await checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 });

    expect(backfill.runPass1).not.toHaveBeenCalled();
  });

  test('swallows DB error for pass 1 check', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    await expect(checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 })).resolves.not.toThrow();
    expect(backfill.runPass1).not.toHaveBeenCalled();
  });
});

describe('Pass 2 (TMDB director lookup)', () => {
  test('skips pass2 entirely when no TMDB_API_KEY', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ cnt: '0' }] });

    await checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(backfill.runPass2).not.toHaveBeenCalled();
  });

  test('starts runPass2 when TMDB_API_KEY set and count > 0', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '3' }] });

    await checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 });

    expect(backfill.runPass2).toHaveBeenCalledWith('test-key');
  });

  test('starts runPass2 when TMDB_READ_ACCESS_TOKEN set and count > 0', async () => {
    process.env.TMDB_READ_ACCESS_TOKEN = 'bearer-token';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '2' }] });

    await checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 });

    expect(backfill.runPass2).toHaveBeenCalledWith('bearer-token');
  });

  test('skips runPass2 when count is 0 even with TMDB key', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] });

    await checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 });

    expect(backfill.runPass2).not.toHaveBeenCalled();
  });

  test('swallows DB error for pass2 check', async () => {
    process.env.TMDB_API_KEY = 'key';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
      .mockRejectedValueOnce(new Error('DB crash'));

    await expect(checkAndBackfill({ runPass1Task: backfill.runPass1, runPass2Task: backfill.runPass2 })).resolves.not.toThrow();
    expect(backfill.runPass2).not.toHaveBeenCalled();
  });
});
