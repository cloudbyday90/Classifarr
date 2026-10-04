/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const SIGNALS = new Set(['SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGHUP', 'SIGILL', 'SIGINT', 'SIGKILL',
  'SIGPIPE', 'SIGQUIT', 'SIGSEGV', 'SIGSYS', 'SIGTERM', 'SIGTRAP', 'SIGXCPU', 'SIGXFSZ']);

/**
 * Only a native exit tuple, never arbitrary subprocess or error properties.
 * @param {{code?: number | null, signal?: string | null}} [result]
 */
export function projectDatabaseStartupExit({ code, signal } = {}) {
  if ((Number.isInteger(code) && code >= 0 && code <= 255 && signal === null)
    || (code === null && SIGNALS.has(signal))) return { exitCode: code, exitSignal: signal };
  return {};
}
