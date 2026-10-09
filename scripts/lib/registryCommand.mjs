/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';

/** Bounded private capture. Never log this result without an allowlist projection. */
export function registryCommand(command, args, { input, env = process.env, signal,
  timeoutMs = 30_000, maxBytes = 64 * 1024 } = {}) {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve({ ok: false, cancelled: true }); return; }
    const childEnv = { ...env };
    delete childEnv.INPUT_PASSWORD;
    delete childEnv.INPUT_USERNAME;
    delete childEnv.DEBUG;
    let stdout = '', stderr = '', bytes = 0, timedOut = false, outputLimited = false;
    let child;
    try {
      child = spawn(command, args, { env: childEnv, shell: false, windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'] });
    } catch { resolve({ ok: false }); return; }
    const stop = () => child.kill('SIGKILL');
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true });
    const capture = (chunk, stream) => {
      bytes += chunk.length;
      if (bytes > maxBytes) { outputLimited = true; stop(); return; }
      if (stream === 'stdout') stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on('data', chunk => capture(chunk, 'stdout'));
    child.stderr.on('data', chunk => capture(chunk, 'stderr'));
    // Early command exit may close stdin; do not expose an uncaught EPIPE.
    child.stdin.on('error', () => {});
    child.on('error', () => {});
    child.on('close', exitCode => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      resolve({ ok: exitCode === 0 && !timedOut && !outputLimited && !signal?.aborted,
        stdout, stderr, timedOut, outputLimited, cancelled: Boolean(signal?.aborted) });
    });
    child.stdin.end(input);
  });
}

export function registryFailure(result) {
  if (result.cancelled) return 'cancelled';
  if (result.outputLimited) return 'output_limit';
  if (result.ok) return 'ok';
  const text = `${result.stderr ?? ''}\n${result.stdout ?? ''}`;
  // Nested quota/auth/certificate failures take priority over an outer HTTP 500.
  if (/toomanyrequests|too many requests|pull rate limit|\b429\b/i.test(text)) return 'rate_limit';
  if (/unauthorized|forbidden|denied|incorrect.*credentials|\b40[13]\b/i.test(text)) return 'credentials_rejected';
  if (/certificate|x509|tls verification|unknown authority/i.test(text)) return 'tls_failure';
  if (result.timedOut || /ETIMEDOUT|ECONNRESET|context deadline exceeded|Client\.Timeout|timed? out|connection reset/i.test(text)) return 'transport_timeout';
  if (/(?:HTTP (?:code|status)|status(?: code)?)[:\s(]+(?:500|502|503|504)\b/i.test(text)) return 'registry_unavailable';
  return 'unknown_failure';
}

export function isTransientRegistryFailure(code) {
  return code === 'transport_timeout' || code === 'registry_unavailable';
}
