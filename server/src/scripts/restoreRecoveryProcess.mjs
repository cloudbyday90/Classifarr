/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';

export async function waitFor(check, label, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`timeout:${label}`);
}

/** Fixed real entrypoint and isolated loopback ports; never shell commands. */
export function startDrillProcess(mode, port) {
  if (!['normal', 'restore'].includes(mode) || ![21324, 21325].includes(port)) {
    throw new Error('invalid_drill_process');
  }
  const child = spawn(process.execPath, [resolve(import.meta.dirname, '../index.mjs')], {
    env: { ...process.env, CLASSIFARR_RUNTIME_MODE: mode, PORT: String(port) },
    shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '', exited = false, code = null;
  const append = data => { diagnostic = (diagnostic + data.toString()).slice(-16_384); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', () => { exited = true; });
  child.on('exit', value => { exited = true; code = value; });
  return {
    get exited() { return exited; },
    async expectRejected(reason) {
      await waitFor(() => exited, 'normal_rejection', 30_000);
      if (code !== 1 || !diagnostic.includes(reason)) throw new Error('unexpected_startup_failure');
    },
    async stop(signal = 'SIGTERM') {
      if (!exited) child.kill(signal);
      try { await waitFor(() => exited, 'child_exit', 15_000); }
      catch {
        child.kill('SIGKILL');
        await waitFor(() => exited, 'child_kill', 5_000);
      }
    },
  };
}

export async function drillRequest(path, { port = 21324, session, body, timeout = 30_000 } = {}) {
  if (!path.startsWith('/api/') && path !== '/health') throw new Error('invalid_drill_path');
  if (![21324, 21325].includes(port)) throw new Error('invalid_drill_port');
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error', signal: AbortSignal.timeout(timeout),
    headers: { 'content-type': 'application/json', ...session },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
}

export async function waitForDrillHealth(child, mode) {
  await waitFor(async () => {
    if (child.exited) throw new Error(`startup_failed:${mode}`);
    try {
      const result = await drillRequest('/health', { timeout: 1_000 });
      return result.status === 200 && (mode === 'restore'
        ? result.body.operatingMode === 'restore' && result.body.workersActive === false
        : result.body.status === 'healthy');
    } catch { return false; }
  }, `health:${mode}`, 120_000);
}
