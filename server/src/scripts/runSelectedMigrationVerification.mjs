/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runSelectedVerificationBootstrap } from '../bootstrap/selectedVerificationBootstrap.mjs';

if (import.meta.main) {
  const cancellation = new AbortController();
  const stop = () => cancellation.abort();
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  try { await runSelectedVerificationBootstrap({ stream: process.stdin, signal: cancellation.signal }); }
  catch {
    process.stderr.write('Selected migration verification failed; no runtime admitted.\n');
    // The trusted supervisor must fail the container if any descendant is unjoined.
    // eslint-disable-next-line n/no-process-exit -- fatal isolated verifier cannot stay alive on an unjoined PostgreSQL child
    process.exit(1);
  } finally { process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop); }
}
