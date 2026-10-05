/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { selectedDeploymentConfiguration } from './selectedDeploymentConfiguration.mjs';
import { validateSelectedSystemIdentifier } from './selectedMigrationPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';

const maximumBytes = 64 * 1024;
export const selectedVerificationEnvironment = () => ({ PATH: '/usr/local/bin:/usr/bin:/bin',
  HOME: '/root', LANG: 'C.UTF-8', NODE_OPTIONS: '--max-old-space-size=256' });

function validateRequest(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).sort().join(',') !== 'environment,expectedSystemId') throw new Error('selected_verification_input_invalid');
  validateSelectedSystemIdentifier(value.expectedSystemId);
  return selectedDeploymentConfiguration(value.environment, { allowRestoreHttp: true });
}

/** Canonical JSON prevents duplicate keys, invalid UTF-8 and extra framing. */
export async function readSelectedVerificationRequest(stream, { signal, timeoutMs = 2000 } = {}) {
  const chunks = []; let bytes = 0;
  const cancel = () => stream.destroy(new Error('selected_verification_input_invalid'));
  const timer = setTimeout(cancel, timeoutMs);
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) throw new Error('selected_verification_input_invalid');
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > maximumBytes) throw new Error('selected_verification_input_invalid');
      chunks.push(chunk);
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    const request = JSON.parse(text);
    if (JSON.stringify(request) !== text) throw new Error('selected_verification_input_invalid');
    const profile = validateRequest(request);
    signal?.throwIfAborted();
    return { request, profile };
  } catch { throw new Error('selected_verification_input_invalid'); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

/** Trusted root parent retains the journal lease. No settings in argv or child env. */
export async function verifySelectedMigrationThroughHandoff({ environment, expectedSystemId, signal,
  spawnFn = spawn, platform = process.platform, uid = process.getuid?.(),
}) {
  if (platform !== 'linux' || uid !== 0) throw new Error('selected_verification_root_required');
  signal?.throwIfAborted();
  const request = { environment, expectedSystemId }, profile = validateRequest(request);
  const payload = Buffer.from(JSON.stringify(request));
  if (payload.length > maximumBytes) throw new Error('selected_verification_input_invalid');
  const child = spawnFn('/usr/local/bin/node', ['/app/src/scripts/runSelectedMigrationVerification.mjs', '--verify'], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: selectedVerificationEnvironment(),
  });
  const observed = observeEmbeddedMaintenance(child, payload);
  let cancelled = false, killTimer;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true; observed.signal('SIGTERM');
    killTimer = setTimeout(() => observed.signal('SIGKILL'), 25_000);
  };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const budget = profile.supervisor.databaseStartupTimeoutMs + 90_000;
  const timer = setTimeout(cancel, budget);
  try {
    let result;
    try { result = await waitForEmbeddedExit(observed.done, budget + 27_000); }
    catch { throw new Error('selected_verification_child_unjoined'); }
    if (cancelled || result.code !== 0 || result.signal !== null) throw new Error('selected_verification_failed');
  } finally {
    clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', cancel);
  }
}
