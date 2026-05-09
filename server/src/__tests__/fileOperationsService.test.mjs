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
import { Readable } from 'node:stream';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockFileHandle = {
  createReadStream: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockFs = {
  promises: {
    stat: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    chmod: jest.fn(),
    chown: jest.fn(),
    utimes: jest.fn(),
    readdir: jest.fn(),
    rm: jest.fn(),
    open: jest.fn().mockResolvedValue(mockFileHandle),
  },
  constants: { R_OK: 4, W_OK: 2 }
};

const mockDb = { query: jest.fn() };

const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  }))
};

jest.mock('fs', () => mockFs);

await jest.unstable_mockModule('fs', () => createMockModule(mockFs));
await jest.unstable_mockModule('node:fs', () => createMockModule(mockFs));
await jest.unstable_mockModule('node:fs/promises', () => ({ ...mockFs.promises, default: mockFs.promises }));
await jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));
await jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const { fileOperationsService: svc } = await import('../services/fileOperationsService.mjs');
const fsModule = mockFs;
const fsp = fsModule.promises;
const db = mockDb;

const FILE_STAT = {
  isDirectory: () => false, isFile: () => true,
  size: 1024, mode: 0o644, uid: 1000, gid: 1000,
  atime: new Date(), mtime: new Date()
};

beforeEach(() => {
  fsp.stat.mockReset();
  fsp.access.mockReset();
  fsp.mkdir.mockReset();
  fsp.copyFile.mockReset();
  fsp.chmod.mockReset();
  fsp.chown.mockReset();
  fsp.utimes.mockReset();
  fsp.readdir.mockReset();
  fsp.rm.mockReset();
  fsp.open.mockReset();
  mockFileHandle.createReadStream.mockReset();
  mockFileHandle.close.mockReset();
  db.query.mockReset();
  jest.restoreAllMocks();

  fsp.open.mockResolvedValue(mockFileHandle);
  mockFileHandle.close.mockResolvedValue(undefined);
  fsp.mkdir.mockResolvedValue();
  fsp.copyFile.mockResolvedValue();
  fsp.chmod.mockResolvedValue();
  fsp.chown.mockResolvedValue();
  fsp.utimes.mockResolvedValue();
  fsp.rm.mockResolvedValue();
});

describe('translatePath', () => {
  beforeEach(() => {
    svc._pathMappingsCache = null;
    svc._pathMappingsCacheTime = 0;
  });

  test('queries DB and applies matching mapping', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, arr_path: '/media/', local_path: '/mnt/media/' }] });
    const result = await svc.translatePath('/media/movies/test.mkv');
    expect(result).toBe('/mnt/media/movies/test.mkv');
  });

  test('returns original path when no mapping matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await svc.translatePath('/unknown/path.mkv');
    expect(result).toBe('/unknown/path.mkv');
  });

  test('uses cached mappings within 60 seconds', async () => {
    svc._pathMappingsCache = [{ arr_path: '/arr/', local_path: '/local/' }];
    svc._pathMappingsCacheTime = Date.now();
    const result = await svc.translatePath('/arr/file.mkv');
    expect(result).toBe('/local/file.mkv');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns original path and swallows DB error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const result = await svc.translatePath('/some/path.mkv');
    expect(result).toBe('/some/path.mkv');
  });
});

describe('clearPathMappingsCache', () => {
  test('clears cache', () => {
    svc._pathMappingsCache = [{}];
    svc._pathMappingsCacheTime = Date.now();
    svc.clearPathMappingsCache();
    expect(svc._pathMappingsCache).toBeNull();
    expect(svc._pathMappingsCacheTime).toBe(0);
  });
});

describe('calculateChecksum', () => {
  test('returns sha256 hex checksum', async () => {
    mockFileHandle.createReadStream.mockReturnValueOnce(
      Readable.from([Buffer.from('hello world')])
    );

    const result = await svc.calculateChecksum('/some/file.mkv');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    expect(fsp.open).toHaveBeenCalledWith('/some/file.mkv', 'r');
    expect(mockFileHandle.close).toHaveBeenCalled();
  });

  test('rejects on stream error', async () => {
    async function* errorStream() { throw new Error('read error'); }
    mockFileHandle.createReadStream.mockReturnValueOnce(Readable.from(errorStream()));

    await expect(svc.calculateChecksum('/bad/file.mkv')).rejects.toThrow('read error');
    expect(mockFileHandle.close).toHaveBeenCalled();
  });
});

describe('checksumVerify', () => {
  test('returns success=true when checksums match', async () => {
    jest.spyOn(svc, 'calculateChecksum')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('abc123');
    const result = await svc.checksumVerify('/src/file.mkv', '/dest/file.mkv');
    expect(result.success).toBe(true);
    expect(result.checksum1).toBe('abc123');
  });

  test('returns success=false when checksums differ', async () => {
    jest.spyOn(svc, 'calculateChecksum')
      .mockResolvedValueOnce('abc123')
      .mockResolvedValueOnce('different');
    const result = await svc.checksumVerify('/src/file.mkv', '/dest/file.mkv');
    expect(result.success).toBe(false);
  });

  test('returns success=false with error on exception', async () => {
    jest.spyOn(svc, 'calculateChecksum').mockRejectedValueOnce(new Error('read failed'));
    const result = await svc.checksumVerify('/src/file.mkv', '/dest/file.mkv');
    expect(result.success).toBe(false);
    expect(result.error).toBe('read failed');
  });
});

describe('getStats', () => {
  test('returns stats object when file exists', async () => {
    fsp.stat.mockResolvedValueOnce(FILE_STAT);
    const result = await svc.getStats('/some/file.mkv');
    expect(result.exists).toBe(true);
    expect(result.isFile).toBe(true);
    expect(result.size).toBe(1024);
  });

  test('returns exists=false for ENOENT', async () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    fsp.stat.mockRejectedValueOnce(err);
    const result = await svc.getStats('/missing/file.mkv');
    expect(result.exists).toBe(false);
    expect(result.path).toBe('/missing/file.mkv');
  });

  test('re-throws on non-ENOENT errors', async () => {
    const err = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    fsp.stat.mockRejectedValueOnce(err);
    await expect(svc.getStats('/protected/file.mkv')).rejects.toThrow('permission denied');
  });
});

describe('getDryRunIssues', () => {
  test('returns empty array when all checks pass', () => {
    const checks = { srcExists: true, srcReadable: true, destParentExists: true, destParentWritable: true, destConflict: false };
    expect(svc.getDryRunIssues(checks)).toEqual([]);
  });

  test('reports all issues', () => {
    const checks = { srcExists: false, srcReadable: false, destParentExists: false, destParentWritable: false, destConflict: true };
    const issues = svc.getDryRunIssues(checks);
    expect(issues).toHaveLength(5);
    expect(issues).toContain('Source does not exist');
    expect(issues).toContain('Destination already exists');
  });

  test('reports individual issues', () => {
    const checks = { srcExists: true, srcReadable: false, destParentExists: true, destParentWritable: true, destConflict: false };
    expect(svc.getDryRunIssues(checks)).toContain('Source is not readable');
  });
});

describe('formatBytes', () => {
  test('returns "0 B" for 0', () => {
    expect(svc.formatBytes(0)).toBe('0 B');
  });

  test('formats bytes', () => {
    expect(svc.formatBytes(512)).toBe('512 B');
  });

  test('formats kilobytes', () => {
    expect(svc.formatBytes(1024)).toBe('1 KB');
  });

  test('formats gigabytes', () => {
    expect(svc.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });
});

describe('copyFileWithPermissions', () => {
  test('copies file and returns success=true', async () => {
    jest.spyOn(svc, 'getStats')
      .mockResolvedValueOnce({ exists: true, isFile: true, size: 500, mode: 0o644, uid: 1000, gid: 1000, atime: new Date(), mtime: new Date() })
      .mockResolvedValueOnce({ exists: true, isFile: true, size: 500, mode: 0o644, uid: 1000, gid: 1000 });

    const result = await svc.copyFileWithPermissions('/src/file.mkv', '/dest/file.mkv');
    expect(result.success).toBe(true);
    expect(fsp.copyFile).toHaveBeenCalledWith('/src/file.mkv', '/dest/file.mkv');
  });

  test('returns success=false when source does not exist', async () => {
    jest.spyOn(svc, 'getStats').mockResolvedValueOnce({ exists: false });
    const result = await svc.copyFileWithPermissions('/missing/file.mkv', '/dest/file.mkv');
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  test('returns success=false when source is not a file', async () => {
    jest.spyOn(svc, 'getStats').mockResolvedValueOnce({ exists: true, isFile: false });
    const result = await svc.copyFileWithPermissions('/src/dir', '/dest/dir');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a file');
  });
});

describe('safeDeleteFolder', () => {
  test('deletes without verification when requireVerification=false', async () => {
    const result = await svc.safeDeleteFolder('/src', { requireVerification: false });
    expect(fsp.rm).toHaveBeenCalledWith('/src', { recursive: true, force: true });
    expect(result.success).toBe(true);
    expect(result.deleted).toBe('/src');
  });

  test('refuses to delete when verification fails', async () => {
    jest.spyOn(svc, 'verifyFolderCopy').mockResolvedValueOnce({ success: false });
    const result = await svc.safeDeleteFolder('/src', { requireVerification: true, verifiedAgainst: '/dest' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Verification failed');
    expect(fsp.rm).not.toHaveBeenCalled();
  });

  test('deletes when verification passes', async () => {
    jest.spyOn(svc, 'verifyFolderCopy').mockResolvedValueOnce({ success: true });
    const result = await svc.safeDeleteFolder('/src', { requireVerification: true, verifiedAgainst: '/dest' });
    expect(result.success).toBe(true);
    expect(fsp.rm).toHaveBeenCalled();
  });

  test('returns success=false on rm error', async () => {
    fsp.rm.mockRejectedValueOnce(new Error('rm failed'));
    const result = await svc.safeDeleteFolder('/src', { requireVerification: false });
    expect(result.success).toBe(false);
    expect(result.error).toBe('rm failed');
  });
});

describe('moveFolder', () => {
  test('returns success=true in dry run mode', async () => {
    jest.spyOn(svc, 'dryRunTest').mockResolvedValueOnce({
      success: true, wouldSucceed: true,
      checks: { estimatedSize: 1024, fileCount: 3 },
      issues: []
    });
    const result = await svc.moveFolder('/src', '/dest', { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.fileCount).toBe(3);
  });

  test('fails at preflight when dryRunTest fails', async () => {
    jest.spyOn(svc, 'dryRunTest').mockResolvedValueOnce({
      success: true, wouldSucceed: false, issues: ['Source does not exist']
    });
    const result = await svc.moveFolder('/src', '/dest');
    expect(result.success).toBe(false);
    expect(result.phase).toBe('preflight');
    expect(result.issues).toContain('Source does not exist');
  });

  test('fails at copy phase when copyFolderWithPermissions fails', async () => {
    jest.spyOn(svc, 'dryRunTest').mockResolvedValueOnce({ success: true, wouldSucceed: true, issues: [], checks: {} });
    jest.spyOn(svc, 'copyFolderWithPermissions').mockResolvedValueOnce({ success: false, errors: ['copy error'] });
    const result = await svc.moveFolder('/src', '/dest');
    expect(result.success).toBe(false);
    expect(result.phase).toBe('copy');
  });

  test('fails at verify phase when verification fails', async () => {
    jest.spyOn(svc, 'dryRunTest').mockResolvedValueOnce({ success: true, wouldSucceed: true, issues: [], checks: {} });
    jest.spyOn(svc, 'copyFolderWithPermissions').mockResolvedValueOnce({ success: true, totalFiles: 2, totalSize: 1024 });
    jest.spyOn(svc, 'verifyFolderCopy').mockResolvedValueOnce({ success: false });
    const result = await svc.moveFolder('/src', '/dest');
    expect(result.success).toBe(false);
    expect(result.phase).toBe('verify');
  });

  test('returns success=true on complete move', async () => {
    jest.spyOn(svc, 'dryRunTest').mockResolvedValueOnce({ success: true, wouldSucceed: true, issues: [], checks: {} });
    jest.spyOn(svc, 'copyFolderWithPermissions').mockResolvedValueOnce({ success: true, totalFiles: 5, totalSize: 5000 });
    jest.spyOn(svc, 'verifyFolderCopy').mockResolvedValueOnce({ success: true });
    jest.spyOn(svc, 'safeDeleteFolder').mockResolvedValueOnce({ success: true });
    const result = await svc.moveFolder('/src', '/dest');
    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(5);
    expect(result.totalSize).toBe(5000);
  });

  test('returns success=true with warning when source delete fails', async () => {
    jest.spyOn(svc, 'dryRunTest').mockResolvedValueOnce({ success: true, wouldSucceed: true, issues: [], checks: {} });
    jest.spyOn(svc, 'copyFolderWithPermissions').mockResolvedValueOnce({ success: true, totalFiles: 1, totalSize: 100 });
    jest.spyOn(svc, 'verifyFolderCopy').mockResolvedValueOnce({ success: true });
    jest.spyOn(svc, 'safeDeleteFolder').mockResolvedValueOnce({ success: false, error: 'permission denied' });
    const result = await svc.moveFolder('/src', '/dest');
    expect(result.success).toBe(true);
    expect(result.warning).toBeDefined();
    expect(result.deleteError).toBe('permission denied');
  });
});
