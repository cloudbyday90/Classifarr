/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ValidationError, NotFoundError } from '../utils/appError.mjs';
import { fs as fsp, path } from './fileOperationsUtils.mjs';

export async function checksumVerify(file1, file2, { calculateChecksum }) {
	try {
		const [checksum1, checksum2] = await Promise.all([
			calculateChecksum(file1),
			calculateChecksum(file2)
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

export async function copyFileWithPermissions(src, dest, options, { getStats, logger }) {
	const { preserveTimestamps = true } = options || {};

	try {
		const srcStats = await getStats(src);
		if (!srcStats.exists) {
			throw new NotFoundError(`Source file does not exist: ${src}`);
		}
		if (!srcStats.isFile) {
			throw new ValidationError(`Source is not a file: ${src}`);
		}

		const destDir = path.dirname(dest);
		await fsp.mkdir(destDir, { recursive: true });

		await fsp.copyFile(src, dest);

		try {
			await fsp.chmod(dest, srcStats.mode);
		} catch (chmodError) {
			logger.warn('Could not preserve file mode', { dest, error: chmodError.message });
		}

		try {
			await fsp.chown(dest, srcStats.uid, srcStats.gid);
		} catch (_chownError) {
			logger.debug('Could not preserve ownership (may require root)', { dest });
		}

		if (preserveTimestamps) {
			try {
				await fsp.utimes(dest, srcStats.atime, srcStats.mtime);
			} catch (utimesError) {
				logger.warn('Could not preserve timestamps', { dest, error: utimesError.message });
			}
		}

		const destStats = await getStats(dest);

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

export async function copyFolderWithPermissions(src, dest, options, { getStats, copyFileWithPermissions: copyFile, logger }) {
	const { preserveTimestamps = true, onProgress = null } = options || {};
	const copiedFiles = [];
	const errors = [];

	try {
		const srcStats = await getStats(src);
		if (!srcStats.exists) {
			throw new NotFoundError(`Source folder does not exist: ${src}`);
		}
		if (!srcStats.isDirectory) {
			throw new ValidationError(`Source is not a directory: ${src}`);
		}

		await fsp.mkdir(dest, { recursive: true });

		try {
			await fsp.chmod(dest, srcStats.mode);
		} catch (chmodError) {
			logger.warn('Could not preserve folder mode', { dest, error: chmodError.message });
		}

		const entries = await fsp.readdir(src, { withFileTypes: true });

		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);

			if (entry.isDirectory()) {
				const subResult = await copyFolderWithPermissions(srcPath, destPath, { preserveTimestamps, onProgress }, { getStats, copyFileWithPermissions: copyFile, logger });
				copiedFiles.push(...subResult.copiedFiles);
				errors.push(...subResult.errors);
			} else if (entry.isFile()) {
				const fileResult = await copyFile(srcPath, destPath, { preserveTimestamps });
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

export async function verifyFolderCopy(src, dest, { checksumVerify: verify }) {
	const results = [];
	const errors = [];

	try {
		const entries = await fsp.readdir(src, { withFileTypes: true });

		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);

			if (entry.isDirectory()) {
				const subResult = await verifyFolderCopy(srcPath, destPath, { checksumVerify: verify });
				results.push(...subResult.results);
				errors.push(...subResult.errors);
			} else if (entry.isFile()) {
				const verifyResult = await verify(srcPath, destPath);
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

export async function safeDeleteFolder(folderPath, options, { verifyFolderCopy: verifyCopy }) {
	const { requireVerification = true, verifiedAgainst = null } = options || {};

	try {
		if (requireVerification && verifiedAgainst) {
			const verifyResult = await verifyCopy(folderPath, verifiedAgainst);
			if (!verifyResult.success) {
				return {
					success: false,
					error: 'Verification failed - refusing to delete source',
					verifyResult
				};
			}
		}

		await fsp.rm(folderPath, { recursive: true, force: true });

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
