/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:https';

const HUB_KEYS = ['https://index.docker.io/v1/', 'https://index.docker.io/v1',
  'docker.io', 'registry-1.docker.io', 'https://registry-1.docker.io'];

export function credentialSummary(config, env = process.env) {
  return { configOverride: Boolean(env.DOCKER_CONFIG), authOverride: Boolean(env.DOCKER_AUTH_CONFIG),
    credentialsStore: Boolean(config?.credsStore),
    hubHelper: HUB_KEYS.some(key => Boolean(config?.credHelpers?.[key])),
    hubAuthEntry: HUB_KEYS.some(key => Boolean(config?.auths?.[key])),
    canonicalHubEntry: Boolean(config?.auths?.['https://index.docker.io/v1/']) };
}

export async function readCredentialSummary(env = process.env) {
  let handle;
  try {
    // Docker owns this job-local path; diagnostics never accept a remote URL or write it.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    handle = await open(join(env.DOCKER_CONFIG || join(homedir(), '.docker'), 'config.json'), 'r');
    const buffer = Buffer.alloc(64 * 1024 + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 64 * 1024) return { ...credentialSummary(null, env), state: 'oversized' };
    return { ...credentialSummary(JSON.parse(buffer.subarray(0, bytesRead).toString()), env), state: 'read' };
  } catch (error) {
    return { ...credentialSummary(null, env), state: error.code === 'ENOENT' ? 'absent' : 'unreadable' };
  } finally { await handle?.close(); }
}

export function probeRegistry(endpoint, { signal, requestFn = request, timeoutMs = 10_000 } = {}) {
  const urls = { registry: 'https://registry-1.docker.io/v2/',
    auth: 'https://auth.docker.io/token?service=registry.docker.io' };
  if (!Object.hasOwn(urls, endpoint)) throw new Error('unsupported_probe');
  const started = performance.now();
  return new Promise(resolve => {
    let done = false;
    const finish = (status, code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ endpoint, status, code, elapsedMs: Math.round(performance.now() - started) });
    };
    const req = requestFn(urls[endpoint], { method: 'GET', signal }, res => {
      finish(res.statusCode, 'response');
      res.destroy(); // Never collect the anonymous token or other response bodies.
    });
    const timer = setTimeout(() => { finish(null, 'timeout'); req.destroy(); }, timeoutMs);
    req.on('error', () => finish(null, signal?.aborted ? 'cancelled' : 'network_error'));
    req.end();
  });
}
