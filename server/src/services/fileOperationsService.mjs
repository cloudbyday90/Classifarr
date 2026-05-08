/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
/* eslint-disable security/detect-non-literal-fs-filename -- paths come from trusted internal config, not user input */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as dbModule from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

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
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fsSync.createReadStream(filePath);

            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    async checksumVerify(file1, file2) {
        try {
            const [checksum1, checksum2] = await Promise.all([
                this.calculateChecksum(file1),
                this.calculateChecksum(file2)
            ]);

            return {
                success: checksum1 === checksum2,
                checksum1,
                checksum2,
                file1,
                file2
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                file1,
                file2
            };
        }
    }

    async getStats(targetPath) {
        try {
            const stats = await fs.stat(targetPath);
            return {
                exists: true,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                size: stats.size,
                mode: stats.mode,
                uid: stats.uid,
                gid: stats.gid,
                atime: stats.atime,
                mtime: stats.mtime,
                path: targetPath
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { exists: false, path: targetPath };
            }
            throw error;
        }
    }

    async copyFileWithPermissions(src, dest, options = {}) {
        const { preserveTimestamps = true } = options;

        try {
            const srcStats = await this.getStats(src);
            if (!srcStats.exists) {
                throw new Error(`Source file does not exist: ${src}`);
            }
            if (!srcStats.isFile) {
                throw new Error(`Source is not a file: ${src}`);
            }

            const destDir = path.dirname(dest);
            await fs.mkdir(destDir, { recursive: true });

            await fs.copyFile(src, dest);

            try {
                await fs.chmod(dest, srcStats.mode);
            } catch (chmodError) {
                this.logger.warn('Could not preserve file mode', { dest, error: chmodError.message });
            }

            try {
                await fs.chown(dest, srcStats.uid, srcStats.gid);
            } catch (_chownError) {
                this.logger.debug('Could not preserve ownership (may require root)', { dest });
            }

            if (preserveTimestamps) {
                try {
                    await fs.utimes(dest, srcStats.atime, srcStats.mtime);
                } catch (utimesError) {
                    this.logger.warn('Could not preserve timestamps', { dest, error: utimesError.message });
                }
            }

            const destStats = await this.getStats(dest);

            return {
                success: true,
                src,
                dest,
                size: srcStats.size,
                srcMode: srcStats.mode,
                destMode: destStats.mode
            };
        } catch (error) {
            this.logger.error('Failed to copy file', { src, dest, error: error.message });
            return {
                success: false,
                src,
                dest,
                error: error.message
            };
        }
    }

    async copyFolderWithPermissions(src, dest, options = {}) {
        const { preserveTimestamps = true, onProgress = null } = options;
        const copiedFiles = [];
        const errors = [];

        try {
            const srcStats = await this.getStats(src);
            if (!srcStats.exists) {
                throw new Error(`Source folder does not exist: ${src}`);
            }
            if (!srcStats.isDirectory) {
                throw new Error(`Source is not a directory: ${src}`);
            }

            await fs.mkdir(dest, { recursive: true });

            try {
                await fs.chmod(dest, srcStats.mode);
            } catch (chmodError) {
                this.logger.warn('Could not preserve folder mode', { dest, error: chmodError.message });
            }

            const entries = await fs.readdir(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                if (entry.isDirectory()) {
                    const subResult = await this.copyFolderWithPermissions(srcPath, destPath, options);
                    copiedFiles.push(...subResult.copiedFiles);
                    errors.push(...subResult.errors);
                } else if (entry.isFile()) {
                    const fileResult = await this.copyFileWithPermissions(srcPath, destPath, { preserveTimestamps });
                    if (fileResult.success) {
                        copiedFiles.push(fileResult);
                        if (onProgress) {
                            onProgress({ type: 'file', path: destPath, size: fileResult.size });
                        }
                    } else {
                        errors.push(fileResult);
                    }
                }
            }

            return {
                success: errors.length === 0,
                src,
                dest,
                copiedFiles,
                errors,
                totalFiles: copiedFiles.length,
                totalSize: copiedFiles.reduce((sum, f) => sum + (f.size || 0), 0)
            };
        } catch (error) {
            this.logger.error('Failed to copy folder', { src, dest, error: error.message });
            return {
                success: false,
                src,
                dest,
                copiedFiles,
                errors: [...errors, { src, dest, error: error.message }],
                totalFiles: copiedFiles.length
            };
        }
    }

    async verifyFolderCopy(src, dest) {
        const results = [];
        const errors = [];

        try {
            const entries = await fs.readdir(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                if (entry.isDirectory()) {
                    const subResult = await this.verifyFolderCopy(srcPath, destPath);
                    results.push(...subResult.results);
                    errors.push(...subResult.errors);
                } else if (entry.isFile()) {
                    const verifyResult = await this.checksumVerify(srcPath, destPath);
                    if (verifyResult.success) {
                        results.push(verifyResult);
                    } else {
                        errors.push(verifyResult);
                    }
                }
            }

            return {
                success: errors.length === 0,
                verified: results.length,
                failed: errors.length,
                results,
                errors
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                results,
                errors
            };
        }
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
                    await fs.access(srcPath, fsSync.constants.R_OK);
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
                    await fs.access(destDir, fsSync.constants.W_OK);
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
        const issues = [];
        if (!checks.srcExists) issues.push('Source does not exist');
        if (!checks.srcReadable) issues.push('Source is not readable');
        if (!checks.destParentExists) issues.push('Destination parent directory does not exist');
        if (!checks.destParentWritable) issues.push('Destination parent directory is not writable');
        if (checks.destConflict) issues.push('Destination already exists');
        return issues;
    }

    async countFolderContents(folderPath) {
        let fileCount = 0;
        let totalSize = 0;

        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(folderPath, entry.name);

            if (entry.isDirectory()) {
                const subResult = await this.countFolderContents(entryPath);
                fileCount += subResult.fileCount;
                totalSize += subResult.totalSize;
            } else if (entry.isFile()) {
                const stats = await fs.stat(entryPath);
                fileCount++;
                totalSize += stats.size;
            }
        }

        return { fileCount, totalSize };
    }

    async safeDeleteFolder(folderPath, options = {}) {
        const { requireVerification = true, verifiedAgainst = null } = options;

        try {
            if (requireVerification && verifiedAgainst) {
                const verifyResult = await this.verifyFolderCopy(folderPath, verifiedAgainst);
                if (!verifyResult.success) {
                    return {
                        success: false,
                        error: 'Verification failed - refusing to delete source',
                        verifyResult
                    };
                }
            }

            await fs.rm(folderPath, { recursive: true, force: true });

            return {
                success: true,
                deleted: folderPath
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: folderPath
            };
        }
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
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export const fileOperationsService = new FileOperationsService();
