/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { inventoryBenchmarkComposePlan } from './lib/inventory-benchmark-compose.mjs';
import { createInventoryBenchmarkDocker } from './lib/inventory-benchmark-docker.mjs';
import { runOwnedInventoryBenchmark } from './lib/inventory-benchmark-lifecycle.mjs';

const execute = promisify(execFile);
const cwd = resolve(import.meta.dirname, '..');
const quiet = { cwd, windowsHide: true, shell: false, timeout: 30_000, maxBuffer: 1024 * 1024 };

/** Uses the running app's immutable image; never builds, pulls, restarts it, or mounts its data. */
export async function runInventoryBenchmarkCompose(argv = process.argv.slice(2), { signal } = {}) {
  signal?.throwIfAborted();
  const format = '{{json .Image}}\n{{json .State.Running}}\n{{json .State.Health.Status}}\n{{json (index .Config.Labels "com.docker.compose.project")}}';
  const { stdout } = await execute('docker', ['inspect', '--format', format, 'classifarr'], quiet);
  const [image, running, health, project] = stdout.trim().split(/\r?\n/).map(value => JSON.parse(value));
  const { stdout: memory } = await execute('docker', ['exec', 'classifarr', 'node', '--input-type=module', '-e',
    'import {freemem} from "node:os"; process.stdout.write(String(freemem()));'], quiet);
  const plan = inventoryBenchmarkComposePlan({ image, running, health, project }, argv, randomUUID(), Number(memory));
  process.stderr.write(`Isolated benchmark: ${plan.name}. App image pinned; live app will not be restarted.\n`);
  return runOwnedInventoryBenchmark(plan, createInventoryBenchmarkDocker(plan, quiet), { signal });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  runInventoryBenchmarkCompose(process.argv.slice(2), { signal: controller.signal }).then(code => { process.exitCode = code; }).catch(error => {
    const cleanup = error.message.startsWith('inventory_benchmark_cleanup_failed:') ? ` Cleanup requires attention: ${error.message.split(':')[1]}.` : '';
    process.stderr.write(`Isolated benchmark failed. Check Docker, app health, host memory and arguments. No live-app restart was requested.${cleanup}\n`);
    process.exitCode = controller.signal.aborted ? 130 : 1;
  }).finally(() => { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); });
}
