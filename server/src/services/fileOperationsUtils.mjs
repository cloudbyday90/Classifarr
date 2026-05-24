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
import path from 'node:path';
import crypto from 'node:crypto';

export async function calculateChecksum(filePath) {
	const hash = crypto.createHash('sha256');
	const fh = await fs.open(filePath, 'r');
	try {
		for await (const chunk of fh.createReadStream()) {
			hash.update(chunk);
		}
	} finally {
		await fh.close();
	}
	return hash.digest('hex');
}

export async function getStats(targetPath) {
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

export function getDryRunIssues(checks) {
	const issues = [];
	if (!checks.srcExists) issues.push('Source does not exist');
	if (!checks.srcReadable) issues.push('Source is not readable');
	if (!checks.destParentExists) issues.push('Destination parent directory does not exist');
	if (!checks.destParentWritable) issues.push('Destination parent directory is not writable');
	if (checks.destConflict) issues.push('Destination already exists');
	return issues;
}

export async function countFolderContents(folderPath) {
	let fileCount = 0;
	let totalSize = 0;

	const entries = await fs.readdir(folderPath, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(folderPath, entry.name);

		if (entry.isDirectory()) {
			const subResult = await countFolderContents(entryPath);
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

export function formatBytes(bytes) {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export { fs, path };
