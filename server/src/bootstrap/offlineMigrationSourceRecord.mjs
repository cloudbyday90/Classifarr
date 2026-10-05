/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { validateSelectedSystemIdentifier } from './selectedMigrationPolicy.mjs';

const keys = ['version', 'source', 'candidate', 'systemId', 'digest', 'bytes', 'entries',
  'applicationUid', 'applicationGid', 'databaseUid', 'databaseGid'];

/** Trusted composition paths only. No configuration/request-controlled filesystem scope. */
export function validateOfflineMigrationPaths(source, candidate) {
  for (const path of [source, candidate]) {
    if (typeof path !== 'string' || !path.startsWith('/') || path === '/' || path.includes('\0')
      || posix.resolve(path) !== path || posix.dirname(path) === '/') throw new Error('migration_source_layout_invalid');
  }
  if (source === candidate || source.startsWith(`${candidate}/`) || candidate.startsWith(`${source}/`)) {
    throw new Error('migration_source_layout_invalid');
  }
}

export function migrationSourceBinding(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).sort().join(',') !== [...keys].sort().join(',') || value.version !== 1
    || typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.digest)
    || !Number.isSafeInteger(value.bytes) || value.bytes < 0 || value.bytes > 8 * 1024 ** 3
    || !Number.isInteger(value.entries) || value.entries < 1 || value.entries > 50000) {
    throw new Error('migration_source_record_invalid');
  }
  validateOfflineMigrationPaths(value.source, value.candidate);
  validateSelectedSystemIdentifier(value.systemId);
  for (const key of ['applicationUid', 'applicationGid', 'databaseUid', 'databaseGid']) {
    if (typeof value[key] !== 'number') throw new Error('migration_source_record_invalid');
    parseEmbeddedId(value[key]);
  }
  if (value.applicationUid === value.databaseUid || value.applicationGid === value.databaseGid) {
    throw new Error('migration_source_identity_collision');
  }
  return createHash('sha256').update(JSON.stringify(Object.fromEntries(keys.map(key => [key, value[key]])))).digest('hex');
}
