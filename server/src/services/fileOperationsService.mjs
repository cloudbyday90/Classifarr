/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import * as dbModule from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { calculateChecksum, getStats, getDryRunIssues, countFolderContents, formatBytes } from './fileOperationsUtils.mjs';
import { checksumVerify, copyFileWithPermissions, copyFolderWithPermissions, verifyFolderCopy, safeDeleteFolder } from './fileOperationsCopy.mjs';

export class FileOperationsService {
    constructor(deps = {}) {
        this._db = deps.db || null;
        this._logger = deps.logger || null;

        this.CHUNK_SIZE = 64 * 1024 * 1024;
        this._pathMappingsCache = null;
        this._pathMappingsCacheTime = 0;
    }

    get db() {
        if (!this._db) {
            this._db = dbModule;
        }
        return this._db;
    }

    get logger() {
        if (!this._logger) {
            this._logger = createLogger('FileOperationsService');
        }
        return this._logger;
    }

    async translatePath(arrPath) {
        try {
            const now = Date.now();
            if (!this._pathMappingsCache || (now - this._pathMappingsCacheTime) > 60000) {
                const result = await this.db.query('SELECT * FROM path_mappings WHERE is_active = true ORDER BY LENGTH(arr_path) DESC');
                this._pathMappingsCache = result.rows;
                this._pathMappingsCacheTime = now;
            }

            for (const mapping of this._pathMappingsCache) {
                if (arrPath.startsWith(mapping.arr_path)) {
                    const translated = arrPath.replace(mapping.arr_path, mapping.local_path);
                    this.logger.debug('Path translated', { original: arrPath, translated, mapping: mapping.id });
                    return translated;
                }
            }

            this.logger.debug('No path mapping found, using original', { path: arrPath });
            return arrPath;
        } catch (error) {
            this.logger.warn('Path translation failed, using original path', { path: arrPath, error: error.message });
            return arrPath;
        }
    }

    clearPathMappingsCache() {
        this._pathMappingsCache = null;
        this._pathMappingsCacheTime = 0;
    }

    async calculateChecksum(filePath) {
        return calculateChecksum(filePath);
    }

    async checksumVerify(file1, file2) {
        return checksumVerify(file1, file2, {
            calculateChecksum: (f) => this.calculateChecksum(f),
        });
    }

    async getStats(targetPath) {
        return getStats(targetPath);
    }

    async copyFileWithPermissions(src, dest, options) {
        return copyFileWithPermissions(src, dest, options, {
            getStats: (p) => this.getStats(p),
            logger: this.logger,
        });
    }

    async copyFolderWithPermissions(src, dest, options) {
        return copyFolderWithPermissions(src, dest, options, {
            getStats: (p) => this.getStats(p),
            copyFileWithPermissions: (s, d, o) => this.copyFileWithPermissions(s, d, o),
            logger: this.logger,
        });
    }

    async verifyFolderCopy(src, dest) {
        return verifyFolderCopy(src, dest, {
            checksumVerify: (f1, f2) => this.checksumVerify(f1, f2),
        });
    }

    async safeDeleteFolder(folderPath, options) {
        return safeDeleteFolder(folderPath, options, {
            verifyFolderCopy: (s, d) => this.verifyFolderCopy(s, d),
        });
    }

    async dryRunTest(srcPath, destPath) {
        const checks = {
            srcExists: false,
            srcReadable: false,
            destParentExists: false,
            destParentWritable: false,
            destConflict: false,
            uidMatch: true,
            gidMatch: true,
            estimatedSize: 0,
            fileCount: 0,
            processUid: process.getuid ? process.getuid() : null,
            processGid: process.getgid ? process.getgid() : null,
            srcUid: null,
            srcGid: null,
            destUid: null,
            destGid: null
        };

        const warnings = [];

        try {
            const srcStats = await this.getStats(srcPath);
            checks.srcExists = srcStats.exists;

            if (srcStats.exists) {
                checks.srcUid = srcStats.uid;
                checks.srcGid = srcStats.gid;

                try {
                    await fs.access(srcPath, constants.R_OK);
                    checks.srcReadable = true;
                } catch {
                    checks.srcReadable = false;
                }

                if (srcStats.isDirectory) {
                    const countResult = await this.countFolderContents(srcPath);
                    checks.estimatedSize = countResult.totalSize;
                    checks.fileCount = countResult.fileCount;
                } else {
                    checks.estimatedSize = srcStats.size;
                    checks.fileCount = 1;
                }

                if (checks.processUid !== null && srcStats.uid !== checks.processUid) {
                    checks.uidMatch = false;
                    warnings.push(`Source file UID (${srcStats.uid}) differs from process UID (${checks.processUid}). Ownership may change after move.`);
                }
                if (checks.processGid !== null && srcStats.gid !== checks.processGid) {
                    checks.gidMatch = false;
                    warnings.push(`Source file GID (${srcStats.gid}) differs from process GID (${checks.processGid}). Group may change after move.`);
                }
            }

            const destDir = path.dirname(destPath);
            const destDirStats = await this.getStats(destDir);
            checks.destParentExists = destDirStats.exists;

            if (destDirStats.exists) {
                checks.destUid = destDirStats.uid;
                checks.destGid = destDirStats.gid;

                try {
                    await fs.access(destDir, constants.W_OK);
                    checks.destParentWritable = true;
                } catch {
                    checks.destParentWritable = false;
                }

                if (checks.processUid !== null && destDirStats.uid !== checks.processUid) {
                    warnings.push(`Destination directory UID (${destDirStats.uid}) differs from process UID (${checks.processUid}). May need elevated permissions.`);
                }
            }

            const destStats = await this.getStats(destPath);
            checks.destConflict = destStats.exists;

            const wouldSucceed =
                checks.srcExists &&
                checks.srcReadable &&
                checks.destParentWritable &&
                !checks.destConflict;

            return {
                success: true,
                wouldSucceed,
                checks,
                issues: this.getDryRunIssues(checks),
                warnings
            };
        } catch (error) {
            return {
                success: false,
                wouldSucceed: false,
                error: error.message,
                checks,
                warnings
            };
        }
    }

    getDryRunIssues(checks) {
        return getDryRunIssues(checks);
    }

    async countFolderContents(folderPath) {
        return countFolderContents(folderPath);
    }

    async moveFolder(src, dest, options = {}) {
        const {
            dryRun = false,
            skipVerification = false,
            onProgress = null
        } = options;

        const startTime = Date.now();
        this.logger.info('Starting folder move', { src, dest, dryRun });

        const dryRunResult = await this.dryRunTest(src, dest);
        if (!dryRunResult.success || !dryRunResult.wouldSucceed) {
            return {
                success: false,
                phase: 'preflight',
                error: 'Preflight check failed',
                issues: dryRunResult.issues || [],
                dryRunResult
            };
        }

        if (dryRun) {
            return {
                success: true,
                dryRun: true,
                wouldSucceed: true,
                estimatedSize: dryRunResult.checks.estimatedSize,
                fileCount: dryRunResult.checks.fileCount,
                message: 'Dry run successful - move would succeed'
            };
        }

        if (onProgress) onProgress({ phase: 'copy', message: 'Copying files...' });

        const copyResult = await this.copyFolderWithPermissions(src, dest, {
            preserveTimestamps: true,
            onProgress
        });

        if (!copyResult.success) {
            try {
                await fs.rm(dest, { recursive: true, force: true });
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup partial copy', { dest, error: cleanupError.message });
            }
            return {
                success: false,
                phase: 'copy',
                error: 'Copy failed',
                copyResult
            };
        }

        if (!skipVerification) {
            if (onProgress) onProgress({ phase: 'verify', message: 'Verifying checksums...' });

            const verifyResult = await this.verifyFolderCopy(src, dest);

            if (!verifyResult.success) {
                try {
                    await fs.rm(dest, { recursive: true, force: true });
                } catch (cleanupError) {
                    this.logger.warn('Failed to cleanup failed copy', { dest, error: cleanupError.message });
                }
                return {
                    success: false,
                    phase: 'verify',
                    error: 'Verification failed - checksums do not match',
                    verifyResult
                };
            }
        }

        if (onProgress) onProgress({ phase: 'cleanup', message: 'Removing source...' });

        const deleteResult = await this.safeDeleteFolder(src, {
            requireVerification: !skipVerification,
            verifiedAgainst: dest
        });

        if (!deleteResult.success) {
            this.logger.warn('Move completed but source deletion failed', { src, error: deleteResult.error });
            return {
                success: true,
                warning: 'Source folder could not be deleted',
                src,
                dest,
                duration: Date.now() - startTime,
                copyResult,
                deleteError: deleteResult.error
            };
        }

        const duration = Date.now() - startTime;
        this.logger.info('Folder move completed successfully', {
            src,
            dest,
            duration,
            fileCount: copyResult.totalFiles,
            totalSize: copyResult.totalSize
        });

        return {
            success: true,
            src,
            dest,
            duration,
            fileCount: copyResult.totalFiles,
            totalSize: copyResult.totalSize,
            message: `Successfully moved ${copyResult.totalFiles} files`
        };
    }

    formatBytes(bytes) {
        return formatBytes(bytes);
    }
}

export const fileOperationsService = new FileOperationsService();
