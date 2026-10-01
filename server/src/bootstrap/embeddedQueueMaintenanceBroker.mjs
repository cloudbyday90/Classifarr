/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { startEmbeddedMaintenance } from './embeddedMaintenanceChild.mjs';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';
import { QUEUE_MAINTENANCE_REQUEST, QUEUE_MAINTENANCE_INTERVAL_MS,
  queueMaintenanceResultByte } from '../utils/queueMaintenanceHandoffProtocol.mjs';

/** Trusted composition supplies only the direct runtime child's inherited descriptor. */
export function createEmbeddedQueueMaintenanceBroker({ channel, identity, databaseName,
  parentUid = process.getuid?.(), start = startEmbeddedMaintenance, wait = waitForEmbeddedExit,
  now = () => performance.now(), report = () => {}, onFatal = () => {},
}) {
  if (parentUid !== 0 || !channel || identity?.name !== 'postgres') throw new Error('maintenance_broker_invalid');
  return createQueueMaintenanceBroker({ channel, wait, now, report, onFatal,
    start: () => start({ kind: 'queueRecovery', identity, databaseName, parentUid }) });
}

/** Shared lifecycle only. Each composition owns and validates its fixed launcher. */
export function createQueueMaintenanceBroker({ channel, start, wait = waitForEmbeddedExit,
  now = () => performance.now(), report = () => {}, onFatal = () => {},
  requestBytes = 1, decodeRequest = frame => {
    if (frame[0] !== QUEUE_MAINTENANCE_REQUEST) throw new Error('maintenance_request_invalid');
  }, intervalMs = QUEUE_MAINTENANCE_INTERVAL_MS, timeoutMs = 90_000, resultByte = queueMaintenanceResultByte,
}) {
  if (!channel || typeof start !== 'function') throw new Error('maintenance_broker_invalid');
  let closed = false, active = null, last = -Infinity, cancel;
  let frame = Buffer.alloc(0);
  const stopping = new Promise(resolve => { cancel = resolve; });
  const close = () => { if (!closed) { closed = true; channel.destroy(); cancel(); } };
  const reject = () => { if (!closed) report('request_rejected'); close(); };
  async function execute(request) {
    if (closed) return;
    let child, joined = false, outcome = 0x45;
    try {
      child = start(request);
      report('assessment_started');
      const result = await wait(Promise.race([child.done, stopping.then(() => null)]), timeoutMs);
      if (result) { joined = true; outcome = resultByte(result); }
    } catch { /* Fixed failure only; never forward a child exception or output. */ }
    finally {
      if (child && !joined) {
        for (const signal of ['SIGTERM', 'SIGKILL']) {
          try { child.signal(signal); await wait(child.done, 2000); joined = true; break; }
          catch { /* A delivered signal alone does not prove exit. */ }
        }
        if (!joined) { close(); onFatal(); throw new Error('maintenance_exit_unconfirmed'); }
      }
    }
    report(outcome === 0x43 ? 'completed' : outcome === 0x44 ? 'deferred' : 'unavailable');
    if (!closed) {
      try { if (!channel.write(Buffer.from([outcome]), error => { if (error) close(); })) close(); }
      catch { close(); }
    }
  }
  const onData = chunk => {
    if (closed) return;
    if (!Buffer.isBuffer(chunk) || chunk.length === 0 || frame.length + chunk.length > requestBytes
      || active || now() - last < intervalMs) { reject(); return; }
    frame = Buffer.concat([frame, chunk]);
    if (frame.length < requestBytes) return;
    let request;
    try { request = decodeRequest(frame); } catch { reject(); return; }
    frame = Buffer.alloc(0);
    last = now();
    // Defer launch until active is set, including synchronous test/adaptor failures.
    active = Promise.resolve().then(() => execute(request));
    active.then(() => { active = null; }, () => { /* stop() retains the rejected join. */ });
  };
  channel.on('data', onData);
  channel.on('error', close);
  channel.on('end', close);
  channel.on('close', close);
  channel.unref?.();
  return { async stop() { close(); await active; channel.removeListener('data', onData); } };
}
