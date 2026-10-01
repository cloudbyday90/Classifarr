/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertCompatibleWorkerEnvironment, assertCompatibleWorkerDatabase } from '../bootstrap/embeddedCompatibleWorkerBoundary.mjs';
import { decodeImageIndexClaim, IMAGE_INDEX_REQUEST_BYTES, IMAGE_INDEX_WORKER_TIMEOUT_MS } from '../utils/imageIndexHandoffProtocol.mjs';
import { runImageIndexMaintenance } from '../services/imageIndexMaintenance.mjs';
import { QueueClaimWriteError } from '../services/queueClaimWriteGuard.mjs';
import { readRuntimeMemory } from '../services/runtimeMemoryBudget.mjs';
import { IMAGE_INDEX_RESULTS, imageIndexResultByte, imageIndexResultCode, imageIndexFailureCode } from '../utils/imageIndexResultProtocol.mjs';

export async function readImageIndexClaim(input) {
  let frame = Buffer.alloc(0);
  for await (const chunk of input) {
    if (!Buffer.isBuffer(chunk) || frame.length + chunk.length > IMAGE_INDEX_REQUEST_BYTES) throw new Error('image_index_claim_invalid');
    frame = Buffer.concat([frame, chunk]);
  }
  return decodeImageIndexClaim(frame);
}

export async function runCompatibleImageIndex({ environment = process.env,
  context = { uid: process.getuid?.(), gid: process.getgid?.(), platform: process.platform, cwd: process.cwd(), args: process.argv.slice(2) },
  input = process.stdin, loadDatabase = () => import('../config/database.mjs'),
  assertDatabase = assertCompatibleWorkerDatabase, run = runImageIndexMaintenance,
  output = message => process.stdout.write(`${message}\n`),
} = {}) {
  let task;
  try {
    assertCompatibleWorkerEnvironment(environment, context);
    if (context.args.length !== 1 || context.args[0] !== '--claim') return 2;
    task = await readImageIndexClaim(input);
  } catch { return 2; }
  let database, code = 1;
  try {
    database = await loadDatabase();
    await assertDatabase(database);
    const result = await run({ database, task, readMemory: readRuntimeMemory });
    code = result.status === 'complete' ? 0 : imageIndexResultCode(result.reason) ?? 75;
  } catch (error) {
    if (error instanceof QueueClaimWriteError && error.reason === 'queue_claim_not_owned') code = 75;
    else code = imageIndexFailureCode(error);
    // The application retains its existing claim-fenced failure/attempt policy.
  } finally {
    if (database) { try { await database.pool.end(); } catch { code = 1; } }
  }
  output(JSON.stringify({ operation: 'image_indexes', authority: 'shared_identity',
    status: IMAGE_INDEX_RESULTS[imageIndexResultByte({ code, signal: null })] }));
  return code;
}

if (import.meta.main) {
  // eslint-disable-next-line n/no-process-exit -- bounds input, connection acquisition and cleanup as well as SQL
  const timer = setTimeout(() => process.exit(1), IMAGE_INDEX_WORKER_TIMEOUT_MS - 5000); timer.unref();
  try { process.exitCode = await runCompatibleImageIndex(); }
  finally { clearTimeout(timer); }
}
