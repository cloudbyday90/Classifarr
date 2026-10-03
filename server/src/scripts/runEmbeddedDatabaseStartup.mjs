/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readDatabaseStartupTimeout, runEmbeddedDatabaseStartup } from '../bootstrap/embeddedDatabaseStartup.mjs';
import { createEmbeddedDatabaseStartupProcess } from '../bootstrap/embeddedDatabaseStartupProcess.mjs';

export async function startEmbeddedDatabase({ processRef = process,
  createProcess = createEmbeddedDatabaseStartupProcess, start = runEmbeddedDatabaseStartup } = {}) {
  const timeoutMs = readDatabaseStartupTimeout(processRef.env);
  const args = processRef.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') return;
  if (args.length !== 1 || args[0] !== '--run' || processRef.platform !== 'linux'
    || !(processRef.getuid?.() > 0) || processRef.cwd() !== '/app') {
    throw new Error('database_startup_environment_invalid');
  }
  const controller = new AbortController();
  const stop = () => controller.abort();
  processRef.on('SIGTERM', stop);
  processRef.on('SIGINT', stop);
  try {
    await start({
      ...createProcess(), timeoutMs, signal: controller.signal,
      report: event => processRef.stdout.write(`${JSON.stringify({ component: 'EmbeddedDatabaseStartup', ...event })}\n`),
    });
  } finally {
    processRef.removeListener('SIGTERM', stop);
    processRef.removeListener('SIGINT', stop);
  }
}

if (import.meta.main) {
  let code = 0;
  try { await startEmbeddedDatabase(); }
  catch (error) {
    code = 1;
    const message = error.message === 'database_startup_timeout_invalid'
      ? 'Invalid PostgreSQL startup timeout. Set CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS (or PGCTLTIMEOUT) to an integer from 1 to 1800 seconds.'
      : 'PostgreSQL startup did not complete. Check /app/data/postgres.log and available storage; no application work was started.';
    process.stderr.write(`${message}\n`);
  }
  // eslint-disable-next-line n/no-process-exit -- a deadline may leave a kernel I/O operation unjoinable; failure must reach the entrypoint
  process.exit(code);
}
