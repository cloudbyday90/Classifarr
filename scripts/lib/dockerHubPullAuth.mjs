/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as delay } from 'node:timers/promises';
import { registryCommand, registryFailure, isTransientRegistryFailure } from './registryCommand.mjs';
import { probeRegistry, readCredentialSummary } from './registryDiagnostics.mjs';

export function trustedPullContext(env) {
  return env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'cloudbyday90/Classifarr'
    && env.GITHUB_REF === 'refs/heads/main' && ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME);
}

export async function authenticateDockerHub({ env = process.env, signal, command = registryCommand,
  probe = probeRegistry, summary = readCredentialSummary, wait = delay,
  report = record => console.log(JSON.stringify(record)) } = {}) {
  if (!trustedPullContext(env)) throw new Error('untrusted_context');
  if (signal?.aborted) throw new Error('cancelled');
  const username = env.INPUT_USERNAME, password = env.INPUT_PASSWORD;
  if (!username?.trim() || !password?.trim()) throw new Error('credentials_missing');
  if (username !== username.trim() || password !== password.trim() || /[\r\n\0]/.test(username + password)) {
    throw new Error('credentials_malformed');
  }
  const config = await summary(env);
  report({ stage: 'credential_configuration', ...config });
  if (config.authOverride) throw new Error('conflicting_auth_override');
  if (!['read', 'absent'].includes(config.state)) throw new Error('credential_configuration_unreadable');
  for (const endpoint of ['registry', 'auth']) report({ stage: 'connectivity', ...await probe(endpoint, { signal }) });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (signal?.aborted) throw new Error('cancelled');
    const started = performance.now();
    const result = await command('docker', ['login', '--password-stdin', '--username', username, 'docker.io'],
      { input: password, env, signal, timeoutMs: 30_000 });
    const code = registryFailure(result);
    report({ stage: 'login', attempt, code, elapsedMs: Math.round(performance.now() - started) });
    if (code === 'ok') { report({ stage: 'authenticated_configuration', ...await summary(env) }); return; }
    if (!isTransientRegistryFailure(code) || attempt === 3) throw new Error(code);
    try { await wait(attempt === 1 ? 10_000 : 30_000, undefined, { signal }); }
    catch { throw new Error('cancelled'); }
  }
}

export async function logoutDockerHub({ env = process.env, command = registryCommand,
  report = record => console.log(JSON.stringify(record)) } = {}) {
  if (!trustedPullContext(env)) throw new Error('untrusted_context');
  const result = await command('docker', ['logout', 'docker.io'], { env, timeoutMs: 30_000 });
  const code = registryFailure(result);
  report({ stage: 'logout', code });
  if (!result.ok) throw new Error('logout_failed');
}
