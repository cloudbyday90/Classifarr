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

jest.mock('fs');
jest.mock('../config/database', () => ({
  query: jest.fn()
}));
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

const fs = require('fs');
const db = require('../config/database');

// We need a fresh require after each test that modifies env vars.
// Use jest.isolateModules for env-sensitive tests.
const avxGuard = require('../services/avxGuard');

beforeEach(() => {
  db.query.mockReset();
  fs.readFileSync.mockReset();
  // Default: all DB writes succeed
  db.query.mockResolvedValue({ rows: [] });
  // Restore env vars touched by tests
  delete process.env.CLASSIFARR_PGVECTOR_BUILD;
  delete process.env.CLASSIFARR_PGVECTOR_VARIANT_SELECTED;
});

// ---------------------------------------------------------------------------
// run() — CPU flag detection via /proc/cpuinfo
// ---------------------------------------------------------------------------

describe('avxGuard.run — CPU detection', () => {
  test('records avx=true, avx2=true when both flags present in cpuinfo', async () => {
    fs.readFileSync.mockReturnValueOnce('flags : fpu avx avx2 sse4_2\n');

    const result = await avxGuard.run();

    expect(result.action).toBe('recorded');

    // The five setSetting calls: last_run, cpu_avx, cpu_avx2, build, selected
    const setterCalls = db.query.mock.calls;
    expect(setterCalls.length).toBe(5);

    const cpuAvxCall = setterCalls.find(c => c[1][0] === 'avx_guard_cpu_avx');
    expect(cpuAvxCall[1][1]).toBe('true');

    const cpuAvx2Call = setterCalls.find(c => c[1][0] === 'avx_guard_cpu_avx2');
    expect(cpuAvx2Call[1][1]).toBe('true');
  });

  test('records avx=true, avx2=false when only avx present', async () => {
    fs.readFileSync.mockReturnValueOnce('flags : fpu vme avx sse4_2\n');

    await avxGuard.run();

    const calls = db.query.mock.calls;
    expect(calls.find(c => c[1][0] === 'avx_guard_cpu_avx')[1][1]).toBe('true');
    expect(calls.find(c => c[1][0] === 'avx_guard_cpu_avx2')[1][1]).toBe('false');
  });

  test('records avx=false, avx2=false when neither flag present', async () => {
    fs.readFileSync.mockReturnValueOnce('flags : fpu vme sse4_2\n');

    await avxGuard.run();

    const calls = db.query.mock.calls;
    expect(calls.find(c => c[1][0] === 'avx_guard_cpu_avx')[1][1]).toBe('false');
    expect(calls.find(c => c[1][0] === 'avx_guard_cpu_avx2')[1][1]).toBe('false');
  });

  test('records avx=unknown, avx2=unknown when /proc/cpuinfo is unavailable', async () => {
    fs.readFileSync.mockImplementationOnce(() => { throw new Error('ENOENT'); });

    await avxGuard.run();

    const calls = db.query.mock.calls;
    expect(calls.find(c => c[1][0] === 'avx_guard_cpu_avx')[1][1]).toBe('unknown');
    expect(calls.find(c => c[1][0] === 'avx_guard_cpu_avx2')[1][1]).toBe('unknown');
  });

  test('avx word-boundary match: "avxother" does not trigger avx=true', async () => {
    fs.readFileSync.mockReturnValueOnce('flags : fpu vme avxother\n');

    await avxGuard.run();

    const calls = db.query.mock.calls;
    expect(calls.find(c => c[1][0] === 'avx_guard_cpu_avx')[1][1]).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// run() — pgvector env var recording
// ---------------------------------------------------------------------------

describe('avxGuard.run — pgvector env vars', () => {
  beforeEach(() => {
    fs.readFileSync.mockReturnValue('flags : fpu\n');
  });

  test('records default build=multi and selected=generic when env vars absent', async () => {
    const result = await avxGuard.run();

    expect(result.build).toBe('multi');
    expect(result.selected).toBe('generic');

    const calls = db.query.mock.calls;
    expect(calls.find(c => c[1][0] === 'avx_guard_pgvector_build')[1][1]).toBe('multi');
    expect(calls.find(c => c[1][0] === 'avx_guard_pgvector_selected')[1][1]).toBe('generic');
  });

  test('records custom build and selected from env vars', async () => {
    process.env.CLASSIFARR_PGVECTOR_BUILD = 'avx2';
    process.env.CLASSIFARR_PGVECTOR_VARIANT_SELECTED = 'avx2';

    const result = await avxGuard.run();

    expect(result.build).toBe('avx2');
    expect(result.selected).toBe('avx2');

    const calls = db.query.mock.calls;
    expect(calls.find(c => c[1][0] === 'avx_guard_pgvector_build')[1][1]).toBe('avx2');
    expect(calls.find(c => c[1][0] === 'avx_guard_pgvector_selected')[1][1]).toBe('avx2');
  });
});

// ---------------------------------------------------------------------------
// run() — setSetting DB behaviour
// ---------------------------------------------------------------------------

describe('avxGuard.run — setSetting DB behaviour', () => {
  beforeEach(() => {
    fs.readFileSync.mockReturnValue('flags : fpu\n');
  });

  test('uses UPSERT SQL (INSERT … ON CONFLICT DO UPDATE)', async () => {
    await avxGuard.run();

    for (const call of db.query.mock.calls) {
      expect(call[0]).toMatch(/ON CONFLICT/i);
    }
  });

  test('records avx_guard_last_run with an ISO timestamp string', async () => {
    await avxGuard.run();

    const lastRunCall = db.query.mock.calls.find(c => c[1][0] === 'avx_guard_last_run');
    expect(lastRunCall).toBeDefined();
    const ts = lastRunCall[1][1];
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  test('silently swallows 42P01 (table does not exist) errors', async () => {
    const tableError = Object.assign(new Error('relation "settings" does not exist'), { code: '42P01' });
    db.query.mockRejectedValue(tableError);

    await expect(avxGuard.run()).resolves.toBeDefined();
  });

  test('propagates unexpected DB errors', async () => {
    const unexpectedError = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    db.query.mockRejectedValue(unexpectedError);

    await expect(avxGuard.run()).rejects.toThrow('connection refused');
  });
});

// ---------------------------------------------------------------------------
// run() — return value contract
// ---------------------------------------------------------------------------

describe('avxGuard.run — return value', () => {
  beforeEach(() => {
    fs.readFileSync.mockReturnValue('flags : fpu\n');
  });

  test('always returns { action, selected, build }', async () => {
    const result = await avxGuard.run();
    expect(result).toHaveProperty('action', 'recorded');
    expect(result).toHaveProperty('selected');
    expect(result).toHaveProperty('build');
  });

  test('action is always "recorded"', async () => {
    const result = await avxGuard.run();
    expect(result.action).toBe('recorded');
  });
});
