/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const execute = promisify(execFile);
export function createInventoryBenchmarkDocker(plan, quiet, transport = { execute, spawn }) {
  const run = async (args, options = {}) => (await transport.execute('docker', args, { ...quiet, ...options })).stdout.trim();
  const owned = async () => {
    const found = await run(['ps', '--all', '--quiet', '--no-trunc', '--filter', `name=^/${plan.name}$`]);
    if (!found) return false;
    if (!/^[a-f0-9]{64}$/.test(found)) throw new Error('inventory_benchmark_container_ambiguous');
    const owner = await run(['inspect', '--format', '{{index .Config.Labels "org.classifarr.benchmark-run"}}', found]);
    if (owner !== plan.runId) throw new Error('inventory_benchmark_container_not_owned');
    return found;
  };
  return {
    start: () => run(plan.args, { env: { ...process.env, CLASSIFARR_BENCHMARK_IMAGE: plan.image,
      CLASSIFARR_BENCHMARK_EPHEMERAL_KEY: randomBytes(32).toString('hex') } }),
    wait: async signal => {
      const code = await run(['wait', plan.name], { signal, timeout: plan.timeoutMs + 30_000 });
      if (!/^\d{1,3}$/.test(code)) throw new Error('inventory_benchmark_exit_invalid');
      return Number(code);
    },
    stop: async () => { const id = await owned(); if (id) await run(['stop', '--time', '10', id]); },
    remove: async () => {
      const id = await owned();
      if (id) await run(['rm', '--force', id]);
      if (await owned()) throw new Error('inventory_benchmark_container_remaining');
    },
    follow: () => {
      const child = transport.spawn('docker', ['logs', '--follow', plan.name], { cwd: quiet.cwd, windowsHide: true, shell: false, stdio: 'inherit' });
      let closing = false;
      const done = new Promise(resolve => {
        child.once('error', () => resolve(false));
        child.once('exit', code => resolve(closing || code === 0));
      });
      return { close: async () => {
        // Drain the final report before detaching; still bound an unresponsive log client.
        await Promise.race([done, delay(1000, undefined, { ref: false })]);
        closing = true; child.kill();
        if (!await done) throw new Error('inventory_benchmark_logs_failed');
      } };
    },
  };
}
