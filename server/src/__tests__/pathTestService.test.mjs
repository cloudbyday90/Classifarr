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

const mockFs = {
  promises: {
    stat: jest.fn(),
    access: jest.fn(),
    readdir: jest.fn(),
    constants: { R_OK: 4, W_OK: 2 }
  }
};

const mockDb = { query: jest.fn() };

const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  }))
};

jest.mock('fs', () => mockFs);

await jest.unstable_mockModule('fs', () => ({ ...mockFs, default: mockFs }));
await jest.unstable_mockModule('node:fs', () => ({ ...mockFs, default: mockFs }));
await jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));
await jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const { default: svc } = await import('../services/pathTestService.mjs');
const fs = mockFs.promises;
const db = mockDb;

beforeEach(() => {
  fs.stat.mockReset();
  fs.access.mockReset();
  fs.readdir.mockReset();
  db.query.mockReset();
  jest.restoreAllMocks();
});

describe('testPathAccessibility', () => {
  test('returns accessible=true with file details for an existing file', async () => {
    fs.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true });
    fs.access.mockResolvedValue();

    const result = await svc.testPathAccessibility('/mnt/movies/movie.mkv');
    expect(result.accessible).toBe(true);
    expect(result.isFile).toBe(true);
    expect(result.isDirectory).toBe(false);
    expect(result.readable).toBe(true);
    expect(result.writable).toBe(true);
    expect(result.path).toBe('/mnt/movies/movie.mkv');
  });

  test('lists directory contents (up to 10) for accessible directories', async () => {
    fs.stat.mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false });
    fs.access.mockResolvedValue();
    const entries = [
      { name: 'a.mkv', isDirectory: () => false },
      { name: 'subdir', isDirectory: () => true }
    ];
    fs.readdir.mockResolvedValueOnce(entries);

    const result = await svc.testPathAccessibility('/mnt/movies');
    expect(result.isDirectory).toBe(true);
    expect(result.contents).toHaveLength(2);
    expect(result.contents[0]).toEqual({ name: 'a.mkv', isDirectory: false });
    expect(result.totalItems).toBe(2);
  });

  test('readable=false when read access denied', async () => {
    fs.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true });
    fs.access.mockRejectedValueOnce(new Error('EACCES')).mockResolvedValueOnce();

    const result = await svc.testPathAccessibility('/mnt/protected.mkv');
    expect(result.accessible).toBe(true);
    expect(result.readable).toBe(false);
    expect(result.writable).toBe(true);
  });

  test('returns accessible=false with ENOENT error and suggestion', async () => {
    const err = new Error('no such file');
    err.code = 'ENOENT';
    fs.stat.mockRejectedValueOnce(err);

    const result = await svc.testPathAccessibility('/mnt/missing');
    expect(result.accessible).toBe(false);
    expect(result.error.code).toBe('ENOENT');
    expect(result.error.suggestion).toMatch(/does not exist/);
  });

  test('returns accessible=false with EACCES error and suggestion', async () => {
    const err = new Error('permission denied');
    err.code = 'EACCES';
    fs.stat.mockRejectedValueOnce(err);

    const result = await svc.testPathAccessibility('/mnt/restricted');
    expect(result.accessible).toBe(false);
    expect(result.error.suggestion).toMatch(/Permission denied/);
  });

  test('returns accessible=false for unknown error', async () => {
    const err = new Error('Unknown');
    err.code = 'UNKNOWN';
    fs.stat.mockRejectedValueOnce(err);

    const result = await svc.testPathAccessibility('/some/path');
    expect(result.accessible).toBe(false);
    expect(result.error.code).toBe('UNKNOWN');
  });

  test('includes testedAt ISO timestamp', async () => {
    const err = new Error('nope');
    err.code = 'ENOENT';
    fs.stat.mockRejectedValueOnce(err);
    const result = await svc.testPathAccessibility('/x');
    expect(result.testedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('testPathTranslation', () => {
  test('tests each provided path and marks translationValid when classiflarrPath accessible', async () => {
    const accessibleResult = { accessible: true, isDirectory: true, contents: [{ name: 'movie.mkv', isDirectory: false }] };
    jest.spyOn(svc, 'testPathAccessibility').mockResolvedValue(accessibleResult);

    const result = await svc.testPathTranslation({
      plexPath: '/plex/movies',
      arrPath: '/arr/movies',
      classiflarrPath: '/classifarr/movies'
    });

    expect(result.plexPath).toEqual(accessibleResult);
    expect(result.arrPath).toEqual(accessibleResult);
    expect(result.classiflarrPath).toEqual(accessibleResult);
    expect(result.translationValid).toBe(true);
    expect(result.suggestions).toContain('Path is accessible from Classifarr container.');
  });

  test('tests sample file when classiflarrPath and sampleFile provided', async () => {
    const accessibleResult = { accessible: true, isDirectory: true, contents: [{}] };
    const fileResult = { accessible: true, isFile: true };
    const spy = jest.spyOn(svc, 'testPathAccessibility')
      .mockResolvedValueOnce(accessibleResult)
      .mockResolvedValueOnce(fileResult);

    const result = await svc.testPathTranslation({
      classiflarrPath: '/mnt/movies',
      sampleFile: 'test.mkv'
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.sampleFileTest).toEqual(fileResult);
    expect(result.suggestions).toContain('Sample file "test.mkv" found and accessible.');
  });

  test('translationValid=false when classiflarrPath is not accessible', async () => {
    jest.spyOn(svc, 'testPathAccessibility').mockResolvedValue({ accessible: false, contents: null });

    const result = await svc.testPathTranslation({ classiflarrPath: '/bad' });
    expect(result.translationValid).toBe(false);
  });
});

describe('testAllMappings', () => {
  test('returns mapping results for all configured mappings', async () => {
    const accessible = { accessible: true, isDirectory: true };
    jest.spyOn(svc, 'testPathAccessibility').mockResolvedValue(accessible);
    db.query.mockResolvedValueOnce({
      rows: [
        { library_id: 1, library_name: 'Movies', arr_type: 'radarr', arr_root_folder_path: '/movies', classifarr_path_prefix: '/mnt/movies' }
      ]
    });

    const result = await svc.testAllMappings(1);
    expect(result.mappingsCount).toBe(1);
    expect(result.mappings[0].libraryName).toBe('Movies');
    expect(result.mappings[0].tests.classiflarrPath).toEqual(accessible);
    expect(result.allValid).toBe(true);
  });

  test('allValid=false when a mapping has no classifarr_path_prefix', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ library_id: 1, library_name: 'Movies', arr_type: 'radarr', arr_root_folder_path: '/movies', classifarr_path_prefix: null }]
    });

    const result = await svc.testAllMappings(1);
    expect(result.allValid).toBe(false);
    expect(result.mappings[0].tests.classiflarrPath.accessible).toBe(false);
  });

  test('propagates DB errors', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    await expect(svc.testAllMappings(1)).rejects.toThrow('DB error');
  });
});

describe('getMediaPathConfig', () => {
  test('returns accessible path config when setting exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ setting_value: '/mnt/media' }] });
    const accessible = { accessible: true, isDirectory: true };
    jest.spyOn(svc, 'testPathAccessibility').mockResolvedValueOnce(accessible);

    const result = await svc.getMediaPathConfig();
    expect(result.configured).toBe(true);
    expect(result.path).toBe('/mnt/media');
    expect(result.accessible).toBe(true);
  });

  test('returns configured=false when no setting found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await svc.getMediaPathConfig();
    expect(result.configured).toBe(false);
    expect(result.path).toBeNull();
    expect(result.suggestion).toMatch(/No media path configured/);
  });

  test('returns error on DB failure', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const result = await svc.getMediaPathConfig();
    expect(result.configured).toBe(false);
    expect(result.error).toBe('DB error');
  });
});

describe('healthCheck', () => {
  test('returns healthy when media path accessible and mappings exist', async () => {
    jest.spyOn(svc, 'getMediaPathConfig').mockResolvedValueOnce({ accessible: true, path: '/mnt/media' });
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const result = await svc.healthCheck();
    expect(result.status).toBe('healthy');
    expect(result.checks.mappings.count).toBe(3);
    expect(result.checks.arrInstances.radarrLinked).toBe(1);
  });

  test('returns degraded when media path not accessible', async () => {
    jest.spyOn(svc, 'getMediaPathConfig').mockResolvedValueOnce({ accessible: false, path: null });
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const result = await svc.healthCheck();
    expect(result.status).toBe('degraded');
  });

  test('returns degraded when DB query for mappings fails', async () => {
    jest.spyOn(svc, 'getMediaPathConfig').mockResolvedValueOnce({ accessible: true });
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const result = await svc.healthCheck();
    expect(result.status).toBe('degraded');
    expect(result.checks.mappings.error).toBe('DB error');
  });

  test('includes ISO timestamp', async () => {
    jest.spyOn(svc, 'getMediaPathConfig').mockResolvedValueOnce({ accessible: true });
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const result = await svc.healthCheck();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
