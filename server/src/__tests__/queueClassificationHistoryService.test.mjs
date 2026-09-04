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
import { createMockDb, createMockLogger, restoreAllAndResetMocks } from './helpers/mockFactory.mjs';

const extract = jest.fn();
jest.unstable_mockModule('../services/ragGraphExtractor.mjs', () => ({
  extract,
  default: { extract }
}));

const { QueueClassificationHistoryService } = await import('../services/queueClassificationHistoryService.mjs');


beforeEach(() => {
  restoreAllAndResetMocks();
  extract.mockReset().mockReturnValue({
    director_name: null, primary_studio_name: null, genre_names: [], cast_ids: [], cast_names: []
  });
});

// ---------------------------------------------------------------------------
// libraryExists
// ---------------------------------------------------------------------------

describe('libraryExists', () => {
  test('returns true when library row exists', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    expect(await svc.libraryExists(5)).toBe(true);
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  test('returns false when library does not exist', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    expect(await svc.libraryExists(99)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// historyEntryExists
// ---------------------------------------------------------------------------

describe('historyEntryExists', () => {
  test('queries by tmdbId when provided', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{}] });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    expect(await svc.historyEntryExists(42, 'My Movie', 1, 'movie')).toBe(true);
    expect(db.query.mock.calls[0][1]).toEqual([42, 1, 'movie']);
  });

  test('queries by title when no tmdbId', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    expect(await svc.historyEntryExists(null, 'Untitled', 1, 'tv')).toBe(false);
    expect(db.query.mock.calls[0][1]).toEqual(['Untitled', 1, 'tv']);
  });
});

// ---------------------------------------------------------------------------
// buildReason
// ---------------------------------------------------------------------------

describe('buildReason', () => {
  const svc = new QueueClassificationHistoryService({ db: createMockDb(), logger: createMockLogger() });

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
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    extract.mockReturnValueOnce({
      director_name: 'Steven Spielberg',
      primary_studio_name: 'Universal',
      genre_names: ['Action'],
      cast_ids: [1, 2],
      cast_names: ['Actor A', 'Actor B']
    });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });

    const payload = { title: 'Indiana Jones', year: 1981, media: { media_type: 'movie' } };
    await svc.insertHistoryEntry(payload, 999, 1, 'Movies');

    expect(db.query).toHaveBeenCalledTimes(1);
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toBe(999);         // tmdb_id
    expect(params[1]).toBe('movie');     // media_type
    expect(params[2]).toBe('Indiana Jones'); // title
    expect(params[8]).toContain('Movies'); // reason
    expect(params[10]).toBe('Steven Spielberg'); // director_name
  });

  test('uses null tmdb_id when not provided', async () => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [] });
    extract.mockReturnValueOnce({
      director_name: null, primary_studio_name: null, genre_names: [], cast_ids: [], cast_names: []
    });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    await svc.insertHistoryEntry({ title: 'X', year: 2000, media: { media_type: 'tv' } }, null, 1, 'Lib');
    expect(db.query.mock.calls[0][1][0]).toBeNull();
    expect(db.query.mock.calls[0][1][1]).toBe('tv');
  });
});

// ---------------------------------------------------------------------------
// persist
// ---------------------------------------------------------------------------

describe('persist', () => {
  test('returns early when no sourceLibraryId', async () => {
    const db = createMockDb();
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    await svc.persist({ title: 'X' }, 1, null, 'Lib', 'task1');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('warns and returns early when library does not exist', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query.mockResolvedValueOnce({ rows: [] }); // libraryExists → false
    const svc = new QueueClassificationHistoryService({ db, logger });
    await svc.persist({ title: 'X', media_type: 'movie' }, 1, 42, 'Lib', 'task1');
    expect(logger.warn).toHaveBeenCalledWith('Source-library history skipped', { reason: 'library_unavailable' });
    expect(db.query).toHaveBeenCalledTimes(1); // only libraryExists
  });

  test('returns early when duplicate history entry exists', async () => {
    const db = createMockDb();
    db.query
      .mockResolvedValueOnce({ rows: [{}] }) // libraryExists → true
      .mockResolvedValueOnce({ rows: [{}] }); // historyEntryExists → true
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    await svc.persist({ title: 'X', media_type: 'movie' }, 10, 1, 'Lib', 'task1');
    expect(db.query).toHaveBeenCalledTimes(2); // libraryExists + historyEntryExists
  });

  test('inserts when library exists and no duplicate', async () => {
    const db = createMockDb();
    extract.mockReturnValueOnce({
      director_name: null, primary_studio_name: null, genre_names: [], cast_ids: [], cast_names: []
    });
    db.query
      .mockResolvedValueOnce({ rows: [{}] }) // libraryExists → true
      .mockResolvedValueOnce({ rows: [] })  // historyEntryExists → false
      .mockResolvedValueOnce({ rows: [] }); // INSERT
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    await svc.persist({ title: 'New Movie', year: 2024, media: { media_type: 'movie' } }, 5, 1, 'Movies', 't1');
    expect(db.query).toHaveBeenCalledTimes(3);
  });
});

describe('source-library identity boundary', () => {
  test.each([
    ['missing type', { title: 'Private title' }, 42, 1],
    ['invalid type', { title: 'Private title', media_type: 'person' }, 42, 1],
    ['conflicting types', { title: 'Private title', media_type: 'movie', media: { media_type: 'tv' } }, 42, 1],
    ['explicit null nested type', { title: 'Private title', media_type: 'movie', media: { media_type: null } }, 42, 1],
    ['explicit blank top-level type', { title: 'Private title', media_type: '', media: { media_type: 'tv' } }, 42, 1],
    ['missing title', { media_type: 'movie' }, 42, 1],
    ['blank title', { title: '  ', media_type: 'movie' }, 42, 1],
    ['oversized title', { title: 'x'.repeat(501), media_type: 'movie' }, 42, 1],
    ['invalid library', { title: 'Private title', media_type: 'movie' }, 42, '1 OR 1=1'],
    ['zero TMDb ID', { title: 'Private title', media_type: 'movie' }, 0, 1],
    ['blank TMDb ID', { title: 'Private title', media_type: 'movie' }, '', 1],
    ['fractional TMDb ID', { title: 'Private title', media_type: 'movie' }, 1.5, 1],
    ['overflow TMDb ID', { title: 'Private title', media_type: 'movie' }, 2147483648, 1],
    ['boolean TMDb ID', { title: 'Private title', media_type: 'movie' }, false, 1],
    ['malformed TMDb ID', { title: 'Private title', media_type: 'movie' }, '42; DROP TABLE classification_history', 1],
  ])('rejects %s without database writes or raw diagnostic data', async (_name, payload, tmdbId, libraryId) => {
    const db = createMockDb();
    const logger = createMockLogger();
    const svc = new QueueClassificationHistoryService({ db, logger });
    await svc.persist(payload, tmdbId, libraryId, 'Private library', 'private-task');
    await svc.insertHistoryEntry(payload, tmdbId, libraryId, 'Private library');
    expect(db.query).not.toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls).toEqual([
      ['Source-library history skipped', { reason: 'invalid_media_identity' }],
      ['Source-library history skipped', { reason: 'invalid_media_identity' }],
    ]);
  });

  test('does not issue an untyped duplicate lookup', async () => {
    const db = createMockDb();
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    expect(await svc.historyEntryExists(42, 'Private title', 1)).toBe(false);
    expect(await svc.libraryExists(-1)).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each([
    { media_type: ' TV ' },
    { media: { media_type: ' TV ' } },
    { media_type: ' TV ', media: { media_type: 'tv' } },
  ])('canonicalizes explicit identity consistently for lookup and insertion: %j', async (declarations) => {
    const db = createMockDb();
    db.query.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValue({ rows: [] });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    await svc.persist({ title: 'Exact title ', ...declarations }, ' 0042 ', ' 01 ', 'TV', 'task');
    expect(db.query.mock.calls[1][1]).toEqual([42, 1, 'tv']);
    expect(db.query.mock.calls[2][1].slice(0, 5)).toEqual([42, 'tv', 'Exact title ', undefined, 1]);
  });

  test('captures identity, metadata and graph fields before the first database wait', async () => {
    const payload = { title: 'Original', year: 2001, media: { media_type: 'tv' }, genres: ['Drama'] };
    const db = createMockDb();
    extract.mockImplementation((metadata) => ({
      director_name: null, primary_studio_name: null, genre_names: metadata.genres, cast_ids: [], cast_names: []
    }));
    db.query.mockImplementationOnce(async () => {
      await Promise.resolve();
      payload.title = 'Mutated';
      payload.year = 2026;
      payload.media.media_type = 'movie';
      payload.genres.push('Action');
      return { rows: [{}] };
    }).mockResolvedValue({ rows: [] });
    const svc = new QueueClassificationHistoryService({ db, logger: createMockLogger() });
    await svc.persist(payload, null, 1, 'TV', 'task');
    expect(db.query.mock.calls[1][1]).toEqual(['Original', 1, 'tv']);
    const inserted = db.query.mock.calls[2][1];
    expect(inserted.slice(0, 5)).toEqual([null, 'tv', 'Original', 2001, 1]);
    expect(JSON.parse(inserted[9])).toEqual({ title: 'Original', year: 2001, media: { media_type: 'tv' }, genres: ['Drama'] });
    expect(inserted[12]).toEqual(['Drama']);
  });
});
