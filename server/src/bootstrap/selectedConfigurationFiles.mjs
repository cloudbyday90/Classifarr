/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { posix } from 'node:path';
import { runEmbeddedDatabaseOperation } from './embeddedDatabaseOperation.mjs';
import { selectedConfigurationFromEnvironment, SELECTED_APPLICATION_DEFAULTS, validSelectedKey } from './selectedApplicationConfiguration.mjs';

const invalid = () => new Error('selected_application_configuration_unavailable');
const flags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

/** No permission changes or privileged reads. Caller has drained same-UID writers. */
export async function inspectSelectedConfiguration({ environment, identity, signal, io = fs }) {
  const config = selectedConfigurationFromEnvironment(environment);
  return runEmbeddedDatabaseOperation(async cancelled => {
    const check = () => cancelled.throwIfAborted();
    const safeOwner = stat => [0, identity.uid].includes(stat.uid) && !(stat.mode & 0o7022);
    async function directory(path, writable = false) {
      const parts = path.split('/').filter(Boolean);
      for (let index = 1; index <= parts.length; index++) {
        check();
        const stat = await io.lstat('/' + parts.slice(0, index).join('/'));
        if (!stat.isDirectory() || !safeOwner(stat)) throw invalid();
        if (index === parts.length && writable && (stat.uid !== identity.uid || stat.gid !== identity.gid)) throw invalid();
      }
      check();
      await io.access(path, constants.X_OK | (writable ? constants.W_OK : 0));
    }
    async function read(path, limit, { secret = false, optional = false } = {}) {
      await directory(posix.dirname(path));
      let file;
      const buffer = Buffer.alloc(limit + 1);
      try {
        check();
        try { file = await io.open(path, flags); }
        catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
        const before = await file.stat();
        if (!before.isFile() || !safeOwner(before) || before.nlink !== 1 || before.size > limit
          || (secret && ((before.mode & 0o007) || ((before.mode & 0o070) && before.gid !== identity.gid)))) throw invalid();
        let size = 0;
        while (size < buffer.length) {
          check();
          const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
          if (!bytesRead) break;
          size += bytesRead;
        }
        check();
        const after = await file.stat();
        if (size > limit || size !== before.size
          || ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'mode', 'uid', 'gid', 'nlink'].some(key => before[key] !== after[key])) throw invalid();
        return buffer.subarray(0, size).toString('utf8');
      } finally { buffer.fill(0); await file?.close(); }
    }
    try {
      const key = config.API_KEY_ENCRYPTION_KEY
        ?? (await read(config.API_KEY_ENCRYPTION_KEY_FILE, 128, { secret: true })).trim();
      if (!validSelectedKey(key)) throw invalid();
      await directory(posix.dirname(config.RUNTIME_SETTINGS_FILE), true);
      const raw = await read(config.RUNTIME_SETTINGS_FILE, 1024 * 1024,
        { optional: config.RUNTIME_SETTINGS_FILE === SELECTED_APPLICATION_DEFAULTS.RUNTIME_SETTINGS_FILE });
      if (raw !== null) {
        const settings = JSON.parse(raw);
        if (!settings || Array.isArray(settings) || typeof settings !== 'object') throw invalid();
      }
      if (config.FILE_LOGGING_ENABLED === 'true') await directory(config.LOG_DIR, true);
      await directory(config.BACKUP_DIR, true);
      check();
      return key;
    } catch { throw invalid(); }
  }, { signal, timeoutMs: 10_000 });
}
