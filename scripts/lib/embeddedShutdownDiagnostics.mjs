/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const commandFailures = new WeakMap();
const codes = new Set(['ERR_ASSERTION', 'ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT', 'ECONNRESET',
  'ECONNREFUSED', 'ENOBUFS', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'ABORT_ERR']);
const reasons = new Set(['shutdown_drill_wait_timeout', 'shutdown_drill_startup_failed',
  'shutdown_drill_collision', 'shutdown_drill_image_changed', 'queue_drill_image_changed',
  'shutdown_order_unconfirmed', 'shutdown_fixture_failed', 'queue_fixture_failed',
  'queue_claim_wait_failed', 'unexpired_claim_must_survive_restart', 'shutdown_resource_remains',
  'shutdown_diagnostics_write_failed', 'shutdown_drill_cleanup_failed', 'invalid_arguments']);

/** No argv, messages, SQL, output or environment is returned, even for unknown errors. */
export function projectShutdownError(error) {
  const seen = new Set();
  let remaining = 8;
  const visit = (value, depth) => {
    if (!value || typeof value !== 'object') return { code: 'unknown_error' };
    if (seen.has(value) || depth > 3 || remaining-- <= 0) return { code: 'error_detail_truncated' };
    seen.add(value);
    const prefix = typeof value.message === 'string' ? value.message.split(':', 1)[0] : '';
    const code = reasons.has(prefix) ? prefix : codes.has(value.code) ? value.code : 'unknown_error';
    const result = { code };
    const command = commandFailures.get(value);
    if (command) result.command = command;
    // Only known repository script filenames and line/column numbers, never paths.
    const locations = typeof value.stack === 'string' ? value.stack.slice(0, 16_384).match(
      /embedded(?:ShutdownDocker|ShutdownChecks|QueueRecoveryChecks)\.mjs:\d{1,6}:\d{1,6}/g) : null;
    if (locations) result.locations = [...new Set(locations)].slice(0, 3);
    if (value.cause) result.cause = visit(value.cause, depth + 1);
    if (value instanceof AggregateError) {
      result.errors = value.errors.slice(0, 8).map(child => visit(child, depth + 1));
      if (value.errors.length > 8) result.truncated = true;
    }
    return result;
  };
  return visit(error, 0);
}

export function shutdownOperation(args) {
  if (['image', 'volume'].includes(args[0]) && ['inspect', 'ls', 'create', 'rm'].includes(args[1])) {
    return `${args[0]}_${args[1]}`;
  }
  return ['ps', 'inspect', 'create', 'start', 'stop', 'logs', 'exec', 'run', 'rm'].includes(args[0])
    ? args[0] : 'other';
}

export function recordShutdownCommandFailure(error, details) {
  const stderr = typeof error?.stderr === 'string' ? error.stderr.slice(0, 16_384) : '';
  const diagnostic = {
    ...details,
    exitCode: Number.isSafeInteger(error?.code) ? error.code : null,
    systemCode: codes.has(error?.code) ? error.code : null,
    signal: ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT'].includes(error?.signal) ? error.signal : null,
    killed: error?.killed === true,
    category: error?.code === 'ETIMEDOUT' || (error?.killed === true && details.elapsedMs >= details.timeoutMs)
      ? 'command_timeout' : /volume is in use/i.test(stderr) ? 'volume_in_use'
        : /removal .*in progress/i.test(stderr) ? 'removal_in_progress'
          : /permission denied|access is denied/i.test(stderr) ? 'permission_denied'
            : /cannot connect to the docker daemon|error during connect/i.test(stderr) ? 'daemon_unavailable'
              : 'command_failed',
  };
  if (error && typeof error === 'object') commandFailures.set(error, diagnostic);
  return diagnostic;
}
