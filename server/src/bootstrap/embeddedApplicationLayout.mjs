/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { assertProtectedMigrationDirectory } from './embeddedMigrationJournal.mjs';
import { readEmbeddedAccounts, requireSeparatedEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';
import { runEmbeddedDatabaseOperation } from './embeddedDatabaseOperation.mjs';

const PARENT = '/app/data';
const CHILDREN = Object.freeze(['/app/data/config', '/app/data/secrets', '/app/data/logs', '/app/data/backups']);
const FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
const invalid = () => new Error('embedded_application_directory_invalid');

/** Fixed children only. Caller owns the migration lease and has drained writers. */
export async function provisionEmbeddedApplicationLayout({ signal, io = fs,
  protect = assertProtectedMigrationDirectory,
  accounts = async () => readEmbeddedAccounts(await fs.readFile('/etc/passwd', 'utf8'), await fs.readFile('/etc/group', 'utf8')),
} = {}) {
  return runEmbeddedDatabaseOperation(async cancelled => {
    await protect(PARENT);
    cancelled.throwIfAborted();
    const { application: { uid, gid } } = requireSeparatedEmbeddedAccounts(await accounts());
    cancelled.throwIfAborted();
    const parent = await io.open(PARENT, FLAGS);
    const entries = [];
    try {
      const parentStat = await parent.stat();
      if (!parentStat.isDirectory() || parentStat.uid !== 0 || (parentStat.mode & 0o022)) throw invalid();
      for (const path of CHILDREN) {
        cancelled.throwIfAborted();
        let file;
        try { file = await io.open(path, FLAGS); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const entry = { path, file, create: !file, handoff: !file };
        entries.push(entry);
        if (!file) continue;
        const stat = await file.stat();
        if (!stat.isDirectory() || stat.dev !== parentStat.dev || (stat.mode & 0o7022)) throw invalid();
        if (stat.uid === uid && stat.gid === gid) continue;
        if (stat.uid !== 0 || stat.gid !== 0) throw invalid();
        // Protected parent prevents replacement; inspect at most one entry.
        const directory = await io.opendir(path);
        try { if (await directory.read()) throw invalid(); }
        finally { await directory.close(); }
        entry.handoff = true;
      }
      // No data/permission write occurs until the complete four-child preflight.
      for (const entry of entries) {
        cancelled.throwIfAborted();
        if (entry.create) {
          await io.mkdir(entry.path, { mode: 0o700 });
          cancelled.throwIfAborted();
          entry.file = await io.open(entry.path, FLAGS);
          const stat = await entry.file.stat();
          if (!stat.isDirectory() || stat.uid !== 0 || stat.gid !== 0 || stat.dev !== parentStat.dev) throw invalid();
        }
        cancelled.throwIfAborted();
        await entry.file.chmod(0o700);
        cancelled.throwIfAborted();
        if (entry.handoff) await entry.file.chown(uid, gid);
        cancelled.throwIfAborted();
        await entry.file.sync();
      }
      cancelled.throwIfAborted();
      await parent.sync();
      for (const { file } of entries) {
        cancelled.throwIfAborted();
        const stat = await file.stat();
        if (stat.uid !== uid || stat.gid !== gid || (stat.mode & 0o7777) !== 0o700) throw invalid();
      }
      cancelled.throwIfAborted();
      return { uid, gid, directories: CHILDREN.length };
    } finally {
      // All retained handles are closed even when one close operation fails.
      const closed = await Promise.allSettled([...entries.map(entry => entry.file?.close()), parent.close()]);
      const failed = closed.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
    }
  }, { signal, timeoutMs: 10_000 });
}
