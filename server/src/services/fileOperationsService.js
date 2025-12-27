/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');
const db = require('../config/database');

const logger = createLogger('FileOperationsService');

/**
 * File Operations Service
 * Handles safe file/folder moves with permission preservation and verification
 * 
 * Key features:
 * - Permission preservation (owner, group, mode)
 * - Checksum verification (SHA256)
 * - Cross-filesystem safe moves (copy → verify → delete)
 * - Dry run mode for testing
 * - Path translation between *arr and Classifarr containers
 */
class FileOperationsService {
    constructor() {
        this.CHUNK_SIZE = 64 * 1024 * 1024; // 64MB chunks for large files
        this._pathMappingsCache = null;
        this._pathMappingsCacheTime = 0;
    }

    /**
     * Translate a path from *arr format to local Classifarr format
     * Uses configured path mappings from database
     * @param {string} arrPath - Path as seen by Radarr/Sonarr
     * @returns {Promise<string>} Translated path for local filesystem
     */
    async translatePath(arrPath) {
        try {
            // Cache mappings for 60 seconds to avoid DB hits
            const now = Date.now();
            if (!this._pathMappingsCache || (now - this._pathMappingsCacheTime) > 60000) {
                const result = await db.query('SELECT * FROM path_mappings WHERE is_active = true ORDER BY LENGTH(arr_path) DESC');
                this._pathMappingsCache = result.rows;
                this._pathMappingsCacheTime = now;
            }

            // Try each mapping (longest match first due to ORDER BY)
            for (const mapping of this._pathMappingsCache) {
                if (arrPath.startsWith(mapping.arr_path)) {
                    const translated = arrPath.replace(mapping.arr_path, mapping.local_path);
                    logger.debug('Path translated', { original: arrPath, translated, mapping: mapping.id });
                    return translated;
                }
            }

            // No mapping found - return as-is
            logger.debug('No path mapping found, using original', { path: arrPath });
            return arrPath;
        } catch (error) {
            logger.warn('Path translation failed, using original path', { path: arrPath, error: error.message });
            return arrPath;
        }
    }

    /**
     * Clear the path mappings cache (call when mappings are updated)
     */
    clearPathMappingsCache() {
        this._pathMappingsCache = null;
        this._pathMappingsCacheTime = 0;
    }

    /**
     * Calculate SHA256 checksum of a file
     * @param {string} filePath - Path to file
     * @returns {Promise<string>} Hex-encoded checksum
     */
    async calculateChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fsSync.createReadStream(filePath);

            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Verify two files have matching checksums
     * @param {string} file1 - First file path
     * @param {string} file2 - Second file path
     * @returns {Promise<Object>} Verification result
     */
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

    /**
     * Get file/folder stats and permissions
     * @param {string} targetPath - Path to check
     * @returns {Promise<Object>} Stats including permissions
     */
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

    /**
     * Copy a file preserving permissions
     * @param {string} src - Source file path
     * @param {string} dest - Destination file path
     * @param {Object} options - Copy options
     * @returns {Promise<Object>} Copy result
     */
    async copyFileWithPermissions(src, dest, options = {}) {
        const { preserveTimestamps = true } = options;

        try {
            // Get source stats
            const srcStats = await this.getStats(src);
            if (!srcStats.exists) {
                throw new Error(`Source file does not exist: ${src}`);
            }
            if (!srcStats.isFile) {
                throw new Error(`Source is not a file: ${src}`);
            }

            // Ensure destination directory exists
            const destDir = path.dirname(dest);
            await fs.mkdir(destDir, { recursive: true });

            // Copy the file
            await fs.copyFile(src, dest);

            // Preserve permissions
            try {
                await fs.chmod(dest, srcStats.mode);
            } catch (chmodError) {
                logger.warn('Could not preserve file mode', { dest, error: chmodError.message });
            }

            // Preserve ownership (requires root)
            try {
                await fs.chown(dest, srcStats.uid, srcStats.gid);
            } catch (chownError) {
                // Non-fatal - often requires root
                logger.debug('Could not preserve ownership (may require root)', { dest });
            }

            // Preserve timestamps
            if (preserveTimestamps) {
                try {
                    await fs.utimes(dest, srcStats.atime, srcStats.mtime);
                } catch (utimesError) {
                    logger.warn('Could not preserve timestamps', { dest, error: utimesError.message });
                }
            }

            // Get dest stats to confirm
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
            logger.error('Failed to copy file', { src, dest, error: error.message });
            return {
                success: false,
                src,
                dest,
                error: error.message
            };
        }
    }

    /**
     * Copy a folder recursively preserving permissions
     * @param {string} src - Source folder path
     * @param {string} dest - Destination folder path
     * @param {Object} options - Copy options
     * @returns {Promise<Object>} Copy result with file list
     */
    async copyFolderWithPermissions(src, dest, options = {}) {
        const { preserveTimestamps = true, onProgress = null } = options;
        const copiedFiles = [];
        const errors = [];

        try {
            // Get source stats
            const srcStats = await this.getStats(src);
            if (!srcStats.exists) {
                throw new Error(`Source folder does not exist: ${src}`);
            }
            if (!srcStats.isDirectory) {
                throw new Error(`Source is not a directory: ${src}`);
            }

            // Create destination folder
            await fs.mkdir(dest, { recursive: true });

            // Preserve folder permissions
            try {
                await fs.chmod(dest, srcStats.mode);
            } catch (chmodError) {
                logger.warn('Could not preserve folder mode', { dest, error: chmodError.message });
            }

            // Recursively copy contents
            const entries = await fs.readdir(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                if (entry.isDirectory()) {
                    // Recurse into subdirectory
                    const subResult = await this.copyFolderWithPermissions(srcPath, destPath, options);
                    copiedFiles.push(...subResult.copiedFiles);
                    errors.push(...subResult.errors);
                } else if (entry.isFile()) {
                    // Copy file
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
                // Skip symlinks and other special files for now
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
            logger.error('Failed to copy folder', { src, dest, error: error.message });
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

    /**
     * Verify a folder copy by checking all file checksums
     * @param {string} src - Original source folder
     * @param {string} dest - Copied destination folder
     * @returns {Promise<Object>} Verification result
     */
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

    /**
     * Dry run test - checks if a move would succeed without doing it
     * @param {string} src - Source path
     * @param {string} dest - Destination path
     * @returns {Promise<Object>} Dry run result
     */
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
            // Check source exists and is readable
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

                // Count files and size
                if (srcStats.isDirectory) {
                    const countResult = await this.countFolderContents(srcPath);
                    checks.estimatedSize = countResult.totalSize;
                    checks.fileCount = countResult.fileCount;
                } else {
                    checks.estimatedSize = srcStats.size;
                    checks.fileCount = 1;
                }

                // Check if process UID matches source UID (for permission preservation)
                if (checks.processUid !== null && srcStats.uid !== checks.processUid) {
                    checks.uidMatch = false;
                    warnings.push(`Source file UID (${srcStats.uid}) differs from process UID (${checks.processUid}). Ownership may change after move.`);
                }
                if (checks.processGid !== null && srcStats.gid !== checks.processGid) {
                    checks.gidMatch = false;
                    warnings.push(`Source file GID (${srcStats.gid}) differs from process GID (${checks.processGid}). Group may change after move.`);
                }
            }

            // Check destination parent exists and is writable
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

                // Additional warning if destination has different ownership
                if (checks.processUid !== null && destDirStats.uid !== checks.processUid) {
                    warnings.push(`Destination directory UID (${destDirStats.uid}) differs from process UID (${checks.processUid}). May need elevated permissions.`);
                }
            }

            // Check for destination conflict
            const destStats = await this.getStats(destPath);
            checks.destConflict = destStats.exists;

            // Determine if dry run would succeed
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

    /**
     * Get human-readable issues from dry run checks
     * @param {Object} checks - Dry run check results
     * @returns {string[]} List of issues
     */
    getDryRunIssues(checks) {
        const issues = [];
        if (!checks.srcExists) issues.push('Source does not exist');
        if (!checks.srcReadable) issues.push('Source is not readable');
        if (!checks.destParentExists) issues.push('Destination parent directory does not exist');
        if (!checks.destParentWritable) issues.push('Destination parent directory is not writable');
        if (checks.destConflict) issues.push('Destination already exists');
        return issues;
    }

    /**
     * Count files and total size in a folder
     * @param {string} folderPath - Folder to count
     * @returns {Promise<Object>} Count result
     */
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

    /**
     * Safe delete a folder after verification
     * @param {string} folderPath - Folder to delete
     * @param {Object} options - Delete options
     * @returns {Promise<Object>} Delete result
     */
    async safeDeleteFolder(folderPath, options = {}) {
        const { requireVerification = true, verifiedAgainst = null } = options;

        try {
            // If verification required, ensure we have a verified copy
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

            // Perform recursive delete
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

    /**
     * Move a folder safely: copy → verify → delete
     * This is the main entry point for media moves
     * @param {string} src - Source folder path
     * @param {string} dest - Destination folder path
     * @param {Object} options - Move options
     * @returns {Promise<Object>} Move result
     */
    async moveFolder(src, dest, options = {}) {
        const {
            dryRun = false,
            skipVerification = false,
            onProgress = null
        } = options;

        const startTime = Date.now();
        logger.info('Starting folder move', { src, dest, dryRun });

        // Step 0: Dry run check
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

        // Step 1: Copy with permissions
        if (onProgress) onProgress({ phase: 'copy', message: 'Copying files...' });

        const copyResult = await this.copyFolderWithPermissions(src, dest, {
            preserveTimestamps: true,
            onProgress
        });

        if (!copyResult.success) {
            // Cleanup partial copy
            try {
                await fs.rm(dest, { recursive: true, force: true });
            } catch (cleanupError) {
                logger.warn('Failed to cleanup partial copy', { dest, error: cleanupError.message });
            }
            return {
                success: false,
                phase: 'copy',
                error: 'Copy failed',
                copyResult
            };
        }

        // Step 2: Verify checksums
        if (!skipVerification) {
            if (onProgress) onProgress({ phase: 'verify', message: 'Verifying checksums...' });

            const verifyResult = await this.verifyFolderCopy(src, dest);

            if (!verifyResult.success) {
                // Cleanup failed copy
                try {
                    await fs.rm(dest, { recursive: true, force: true });
                } catch (cleanupError) {
                    logger.warn('Failed to cleanup failed copy', { dest, error: cleanupError.message });
                }
                return {
                    success: false,
                    phase: 'verify',
                    error: 'Verification failed - checksums do not match',
                    verifyResult
                };
            }
        }

        // Step 3: Delete source
        if (onProgress) onProgress({ phase: 'cleanup', message: 'Removing source...' });

        const deleteResult = await this.safeDeleteFolder(src, {
            requireVerification: !skipVerification,
            verifiedAgainst: dest
        });

        if (!deleteResult.success) {
            // Move succeeded but couldn't delete source - this is a warning, not a failure
            logger.warn('Move completed but source deletion failed', { src, error: deleteResult.error });
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
        logger.info('Folder move completed successfully', {
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

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new FileOperationsService();
