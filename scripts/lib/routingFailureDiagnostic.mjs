/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isNativeError } from 'node:util/types';
import { collectContainerStartupDiagnostic } from './containerStartupDiagnostics.mjs';

const contexts = new WeakMap();
const checks = new Map([
  ['routing_exit_oom', 'exit_oom'],
  ['routing_exit_code', 'exit_code'],
  ['routing_startup_failed', 'startup_running'],
]);

/** Called only after the fixture owner has verified its exact name and label. */
export function captureRoutingFailureContext(error, containerName, options) {
  if (!isNativeError(error) || !/^classifarr-routing-drill-[a-f0-9]{32}$/.test(containerName)) return;
  // The shared collector reconstructs only allowlisted fields; never store raw logs.
  // An error-supplied property cannot impersonate this private context.
  contexts.set(error, collectContainerStartupDiagnostic(containerName, options));
}

const phases = new Set(['preflight', 'baseline', 'seed', 'baseline-stop', 'candidate', 'upgraded',
  'provider', 'arm-crash', 'crash-ready', 'forced-restart', 'restarted', 'movie-ready', 'exhausted',
  'pause-ready', 'paused', 'graceful-restart', 'repair', 'complete-ready', 'complete', 'cleanup']);
const commands = new Set(['image', 'ps', 'volume', 'inspect', 'create', 'start', 'exec', 'kill', 'stop', 'rm']);

/** Reconstruct only fixed categories and source coordinates, never error values. */
export function routingFailureDiagnostic(error, phase) {
  const result = { phase: phases.has(phase) ? phase : 'preflight', reason: 'unexpected_failure' };
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/^routing_cleanup_failed:classifarr-routing-drill-[a-f0-9]{32}$/.test(message)) {
    return { phase: 'cleanup', reason: 'cleanup_failed' };
  }
  if (message === 'routing_wait_timeout') result.reason = 'wait_timeout';
  else if (message.startsWith('routing_probe_failed:')) {
    result.reason = /^routing_probe_failed:missed_crash_window_probe_[0-9]{1,5}$/.test(message)
      ? 'crash_window_expired' : 'probe_failed';
    const location = /_(seed|probe|support)_([1-9][0-9]{0,4})(?:_[0-9a-z]{5})?$/.exec(message);
    if (location) result.location = { file: `${location[1]}.mjs`, line: Number(location[2]) };
  } else if (error?.code === 'ERR_ASSERTION') {
    result.reason = 'assertion_failed';
    // Node may append an assertion diff. Only the fixed first-line identifier escapes.
    const check = checks.get(message.slice(0, 80).split('\n', 1)[0]);
    if (check) result.check = check;
  }
  else {
    const command = /^routing_docker_failed:([a-z]+)$/.exec(message)?.[1];
    if (commands.has(command)) { result.reason = 'docker_failed'; result.command = command; }
  }
  if (contexts.has(error)) result.container = contexts.get(error);
  return result;
}
