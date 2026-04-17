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

jest.mock('../services/ragGraphExtractor', () => ({
  extract: jest.fn()
}));

const ragGraphExtractor = require('../services/ragGraphExtractor');
const { QueueClassificationHistoryService } = require('../services/queueClassificationHistoryService');

const makeDb = () => ({ query: jest.fn() });
const makeLogger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() });

beforeEach(() => {
  ragGraphExtractor.extract.mockReset();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// libraryExists
// ---------------------------------------------------------------------------

describe('libraryExists', () => {
  test('returns true when library row exists', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    expect(await svc.libraryExists(5)).toBe(true);
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  test('returns false when library does not exist', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    expect(await svc.libraryExists(99)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// historyEntryExists
// ---------------------------------------------------------------------------

describe('historyEntryExists', () => {
  test('queries by tmdbId when provided', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [{}] });
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    expect(await svc.historyEntryExists(42, 'My Movie', 1)).toBe(true);
    expect(db.query.mock.calls[0][1]).toEqual([42, 1]);
  });

  test('queries by title when no tmdbId', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    expect(await svc.historyEntryExists(null, 'Untitled', 1)).toBe(false);
    expect(db.query.mock.calls[0][1]).toEqual(['Untitled', 1]);
  });
});

// ---------------------------------------------------------------------------
// buildReason
// ---------------------------------------------------------------------------

describe('buildReason', () => {
  const svc = new QueueClassificationHistoryService({ db: makeDb(), logger: makeLogger() });

  test('with tmdbId: includes library name', () => {
    expect(svc.buildReason(123, 'Movies')).toBe('Already in library: Movies');
  });

  test('without tmdbId: appends no TMDB match note', () => {
    expect(svc.buildReason(null, 'Movies')).toBe('Already in library: Movies (no TMDB match)');
  });
});

// ---------------------------------------------------------------------------
// insertHistoryEntry
// ---------------------------------------------------------------------------

describe('insertHistoryEntry', () => {
  test('inserts history row with graph extractor fields', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    ragGraphExtractor.extract.mockReturnValueOnce({
      director_name: 'Steven Spielberg',
      primary_studio_name: 'Universal',
      genre_names: ['Action'],
      cast_ids: [1, 2],
      cast_names: ['Actor A', 'Actor B']
    });
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });

    const payload = { title: 'Indiana Jones', year: 1981, media: { media_type: 'movie' } };
    await svc.insertHistoryEntry(payload, 999, 1, 'Movies');

    expect(db.query).toHaveBeenCalledTimes(1);
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toBe(999);         // tmdb_id
    expect(params[2]).toBe('Indiana Jones'); // title
    expect(params[8]).toContain('Movies'); // reason
    expect(params[10]).toBe('Steven Spielberg'); // director_name
  });

  test('uses null tmdb_id when not provided', async () => {
    const db = makeDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    ragGraphExtractor.extract.mockReturnValueOnce({
      director_name: null, primary_studio_name: null, genre_names: [], cast_ids: [], cast_names: []
    });
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    await svc.insertHistoryEntry({ title: 'X', year: 2000, media: {} }, null, 1, 'Lib');
    expect(db.query.mock.calls[0][1][0]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// persist
// ---------------------------------------------------------------------------

describe('persist', () => {
  test('returns early when no sourceLibraryId', async () => {
    const db = makeDb();
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    await svc.persist({ title: 'X' }, 1, null, 'Lib', 'task1');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('warns and returns early when library does not exist', async () => {
    const db = makeDb();
    const logger = makeLogger();
    db.query.mockResolvedValueOnce({ rows: [] }); // libraryExists → false
    const svc = new QueueClassificationHistoryService({ db, logger });
    await svc.persist({ title: 'X' }, 1, 42, 'Lib', 'task1');
    expect(logger.warn).toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1); // only libraryExists
  });

  test('returns early when duplicate history entry exists', async () => {
    const db = makeDb();
    db.query
      .mockResolvedValueOnce({ rows: [{}] }) // libraryExists → true
      .mockResolvedValueOnce({ rows: [{}] }); // historyEntryExists → true
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    await svc.persist({ title: 'X' }, 10, 1, 'Lib', 'task1');
    expect(db.query).toHaveBeenCalledTimes(2); // libraryExists + historyEntryExists
  });

  test('inserts when library exists and no duplicate', async () => {
    const db = makeDb();
    ragGraphExtractor.extract.mockReturnValueOnce({
      director_name: null, primary_studio_name: null, genre_names: [], cast_ids: [], cast_names: []
    });
    db.query
      .mockResolvedValueOnce({ rows: [{}] }) // libraryExists → true
      .mockResolvedValueOnce({ rows: [] })  // historyEntryExists → false
      .mockResolvedValueOnce({ rows: [] }); // INSERT
    const svc = new QueueClassificationHistoryService({ db, logger: makeLogger() });
    await svc.persist({ title: 'New Movie', year: 2024, media: { media_type: 'movie' } }, 5, 1, 'Movies', 't1');
    expect(db.query).toHaveBeenCalledTimes(3);
  });
});
