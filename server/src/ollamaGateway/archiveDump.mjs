/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ARCHIVE_LIMIT, gatewayArchiveConfiguration } from './archiveContract.mjs';
import { openArchiveFile } from './archiveFiles.mjs';
import { gatewayError } from './errors.mjs';

export function archiveDumpOptions(configuration, snapshot) {
  const { database } = gatewayArchiveConfiguration(configuration);
  if (typeof snapshot !== 'string' || !/^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}-[0-9]+$/.test(snapshot)) throw gatewayError('gateway_archive_config_invalid');
  return { args: ['--format=custom', '--compress=0', '--schema=ollama_gateway', '--strict-names', '--no-owner', '--no-acl',
    '--no-comments', '--no-security-labels', '--no-password', '--lock-wait-timeout=2000', `--snapshot=${snapshot}`],
  env: { PATH: '/usr/bin:/bin', PGHOST: database.host, PGPORT: String(database.port ?? 5432), PGDATABASE: database.database,
    PGUSER: database.user, PGPASSWORD: database.password ?? '', PGPASSFILE: '/dev/null', PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=2000' } };
}

export async function dumpGatewayArchive(configuration, snapshot, directory, signal) {
  const options = archiveDumpOptions(configuration, snapshot);
  signal?.throwIfAborted();
  const file = await openArchiveFile(directory, 'gateway.dump', true);
  let child, timer, exit;
  const cancel = () => child?.kill('SIGKILL');
  try {
    child = spawn('/usr/bin/pg_dump', options.args, { env: options.env, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
    exit = new Promise(resolve => { child.once('error', () => resolve(false)); child.once('close', code => resolve(code === 0)); });
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    timer = setTimeout(cancel, 60000);
    const digest = createHash('sha256'); let bytes = 0;
    for await (const chunk of child.stdout) {
      signal?.throwIfAborted(); bytes += chunk.length;
      if (bytes > ARCHIVE_LIMIT) throw gatewayError('gateway_archive_size_limit');
      await file.writeFile(chunk); digest.update(chunk);
    }
    if (!await exit || bytes < 5) throw gatewayError('gateway_archive_dump_failed');
    signal?.throwIfAborted(); await file.sync();
    return { name: 'gateway.dump', bytes, sha256: digest.digest('hex') };
  } catch (error) {
    cancel();
    throw gatewayError(error.code === 'gateway_archive_size_limit' ? error.code : 'gateway_archive_dump_failed');
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', cancel);
    await exit; await file.close();
  }
}
