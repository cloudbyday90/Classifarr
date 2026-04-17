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

'use strict';

// All module-level mocks. jest.mock is hoisted so these apply on first load,
// and after jest.resetModules() fresh instances are returned on re-require.
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  }))
}));
jest.mock('../scripts/backfillGraphRelationships', () => ({
  runPass1: jest.fn(),
  runPass2: jest.fn()
}));

// Re-required after each resetModules so we get fresh module state.
let checkAndBackfill;
let db;
let backfill;
let savedEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  delete process.env.TMDB_API_KEY;
  delete process.env.TMDB_READ_ACCESS_TOKEN;

  jest.resetModules();
  jest.restoreAllMocks();

  // After resetModules, re-require all mocked deps to get fresh instances
  db = require('../config/database');
  db.query.mockReset();

  backfill = require('../scripts/backfillGraphRelationships');
  backfill.runPass1.mockReset();
  backfill.runPass2.mockReset();
  backfill.runPass1.mockResolvedValue();
  backfill.runPass2.mockResolvedValue();

  ({ checkAndBackfill } = require('../services/graphRelationshipBackfillService'));
});

afterEach(() => {
  process.env = { ...savedEnv };
});

// ---------------------------------------------------------------------------
// Pass 1
// ---------------------------------------------------------------------------

describe('Pass 1 (metadata extraction)', () => {
  test('starts background runPass1 when count > 0', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '5' }] });  // Pass 1 count

    await checkAndBackfill();

    expect(backfill.runPass1).toHaveBeenCalled();
  });

  test('skips runPass1 when count is 0', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] });

    await checkAndBackfill();

    expect(backfill.runPass1).not.toHaveBeenCalled();
  });

  test('swallows DB error for pass 1 check', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    await expect(checkAndBackfill()).resolves.not.toThrow();
    expect(backfill.runPass1).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pass 2 (TMDB director lookup)
// ---------------------------------------------------------------------------

describe('Pass 2 (TMDB director lookup)', () => {
  test('skips pass2 entirely when no TMDB_API_KEY', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ cnt: '0' }] }); // p1 count

    await checkAndBackfill();

    // Only one db.query call (pass 1 check); no pass 2 check
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(backfill.runPass2).not.toHaveBeenCalled();
  });

  test('starts runPass2 when TMDB_API_KEY set and count > 0', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] }) // p1 count
      .mockResolvedValueOnce({ rows: [{ cnt: '3' }] }); // p2 count

    await checkAndBackfill();

    expect(backfill.runPass2).toHaveBeenCalledWith('test-key');
  });

  test('starts runPass2 when TMDB_READ_ACCESS_TOKEN set and count > 0', async () => {
    process.env.TMDB_READ_ACCESS_TOKEN = 'bearer-token';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '2' }] });

    await checkAndBackfill();

    expect(backfill.runPass2).toHaveBeenCalledWith('bearer-token');
  });

  test('skips runPass2 when count is 0 even with TMDB key', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] });

    await checkAndBackfill();

    expect(backfill.runPass2).not.toHaveBeenCalled();
  });

  test('swallows DB error for pass2 check', async () => {
    process.env.TMDB_API_KEY = 'key';
    db.query
      .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
      .mockRejectedValueOnce(new Error('DB crash'));

    await expect(checkAndBackfill()).resolves.not.toThrow();
    expect(backfill.runPass2).not.toHaveBeenCalled();
  });
});
