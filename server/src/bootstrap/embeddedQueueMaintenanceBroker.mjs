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
  let closed = false, active = null, last = -Infinity, cancel;
  const stopping = new Promise(resolve => { cancel = resolve; });
  const close = () => { if (!closed) { closed = true; channel.destroy(); cancel(); } };
  const reject = () => { if (!closed) report('request_rejected'); close(); };
  async function execute() {
    if (closed) return;
    let child, joined = false, outcome = 0x45;
    try {
      child = start({ kind: 'queueRecovery', identity, databaseName, parentUid });
      report('assessment_started');
      const result = await wait(Promise.race([child.done, stopping.then(() => null)]), 90_000);
      if (result) { joined = true; outcome = queueMaintenanceResultByte(result); }
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
    if (!Buffer.isBuffer(chunk) || chunk.length !== 1 || chunk[0] !== QUEUE_MAINTENANCE_REQUEST
      || active || now() - last < QUEUE_MAINTENANCE_INTERVAL_MS) { reject(); return; }
    last = now();
    // Defer launch until active is set, including synchronous test/adaptor failures.
    active = Promise.resolve().then(execute);
    active.then(() => { active = null; }, () => { /* stop() retains the rejected join. */ });
  };
  channel.on('data', onData);
  channel.on('error', close);
  channel.on('end', close);
  channel.on('close', close);
  channel.unref?.();
  return { async stop() { close(); await active; channel.removeListener('data', onData); } };
}
