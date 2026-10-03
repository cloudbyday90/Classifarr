/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DOCKER_CHECK_OUTPUT_LIMIT } from './dockerCheckCommand.mjs';

// Exact emitted vocabulary only. A prefix/regex match could disclose untrusted text.
const components = new Map([
  ['EmbeddedDatabaseStartup', {
    status: ['starting', 'waiting', 'ready', 'failed', 'process_stopped', 'shutdown_unconfirmed'],
    reason: ['database_startup_cancelled', 'database_startup_timeout', 'database_startup_process_exited',
      'database_startup_probe_failed', 'database_startup_identity_invalid', 'database_startup_port_invalid',
      'database_startup_identity_changed'],
    phase: ['waiting_for_own_process', 'starting_or_recovering', 'waiting_for_connections'],
  }],
  ['EmbeddedSupervisor', {
    status: ['maintenance_started', 'maintenance_completed', 'supervising', 'stopping', 'startup_failed',
      'maintenance_exit_unconfirmed', 'application_drain_failed', 'application_exit_unconfirmed',
      'application_stopped', 'database_stopped', 'database_shutdown_unconfirmed', 'failed', 'stopped',
      'database_probe_exit_unconfirmed', 'database_probe_recovered', 'database_probe_waiting'],
    reason: ['SIGTERM', 'SIGINT', 'application_exit', 'maintenance_exit_unconfirmed',
      'database_operation_timeout', 'database_operation_cancelled', 'database_operation_unjoined',
      'database_probe_grace_expired', 'database_probe_exit_unconfirmed', 'database_unavailable'],
    phase: [],
  }],
]);

/** Observations only; never admission evidence or cross-stream chronology. */
export function readContainerLifecycleEvents(logs) {
  const events = [];
  let limited = false;
  for (const stream of ['stdout', 'stderr']) {
    let content = typeof logs?.[stream] === 'string' ? logs[stream] : '';
    if (content.length > DOCKER_CHECK_OUTPUT_LIMIT) {
      limited = true;
      content = content.slice(-DOCKER_CHECK_OUTPUT_LIMIT);
      // The retained prefix may be part of a JSON line, not a complete event.
      content = content.includes('\n') ? content.slice(content.indexOf('\n') + 1) : '';
    }
    const lines = content.split(/\r?\n/);
    if (lines.length > 100) limited = true;
    const tail = [];
    for (const line of lines.slice(-100)) {
      if (line.length > 4096) { limited = true; continue; }
      try {
        const value = JSON.parse(line);
        const allowed = components.get(value?.component);
        if (!allowed?.status.includes(value.status)) continue;
        const event = { component: value.component, status: value.status, stream };
        for (const key of ['reason', 'phase']) {
          if (allowed[key].includes(value[key])) event[key] = value[key];
        }
        tail.push(event);
        if (tail.length > 16) { tail.shift(); limited = true; }
      } catch { /* Unknown/malformed log content is private, not a diagnosis. */ }
    }
    events.push(...tail);
  }
  return { events, limited };
}

export function formatContainerLifecycleEvents({ events, limited }) {
  return `Lifecycle observations (per stream only${limited ? '; tail limited' : ''}): ` +
    (events.map(event => `${event.component}:${event.status}` +
      `${event.reason ? `/${event.reason}` : ''}${event.phase ? `/${event.phase}` : ''} (${event.stream})`).join(', ') || 'none recognized') + '.';
}
