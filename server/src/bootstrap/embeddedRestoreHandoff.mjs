/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { startSelectedMaintenance } from './embeddedSelectedMaintenance.mjs';
import { SELECTED_RESTORE_MAX_BYTES } from './embeddedSelectedMaintenanceContract.mjs';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';

/** Only the direct restore child's inherited stream; caller holds selection lease. */
export function createSelectedRestoreHandoff({ channel, identity, uid = process.getuid?.(),
  start = startSelectedMaintenance, wait = waitForEmbeddedExit, report = () => {},
  onFatal, receiveTimeoutMs = 10_000, workerTimeoutMs = 185_000,
}) {
  if (uid !== 0 || !channel || typeof onFatal !== 'function') throw new Error('restore_handoff_invalid');
  let closed = false, used = false, active, timer, body, offset = 0, headerSize = 0;
  const header = Buffer.alloc(4);
  let cancel;
  const stopping = new Promise(resolve => { cancel = resolve; });
  const notify = status => { try { report(status); } catch { /* diagnostics do not control admission */ } };
  const clearInput = () => { body?.fill(0); body = undefined; header.fill(0); };
  const close = () => {
    if (closed) return;
    closed = true; clearTimeout(timer); channel.destroy(); cancel();
    if (!active) clearInput();
  };
  const reject = () => { notify('request_rejected'); close(); };
  async function execute() {
    let child, joined = false, resultByte = 0x45;
    try {
      if (closed) return;
      child = start({ operation: 'restore', identity, request: body });
      notify('started');
      const result = await wait(Promise.race([child.done, stopping.then(() => null)]), workerTimeoutMs);
      if (result) {
        joined = true;
        if (result.signal === null) resultByte = ({ 0: 0x43, 2: 0x52, 75: 0x44 })[result.code] ?? 0x45;
      }
    } catch { /* No child output or exceptions cross the privilege boundary. */ }
    finally {
      if (child && !joined) {
        for (const signal of ['SIGTERM', 'SIGKILL']) {
          try { child.signal(signal); await wait(child.done, 2000); joined = true; break; }
          catch { /* Signals alone do not prove exit. */ }
        }
        if (!joined) { close(); onFatal(); throw new Error('restore_worker_exit_unconfirmed'); }
      }
      clearInput();
    }
    notify(resultByte === 0x43 ? 'complete' : resultByte === 0x44 ? 'deferred' : 'unavailable');
    if (!closed) channel.end(Buffer.from([resultByte]), close);
  }
  channel.on('data', chunk => {
    if (closed) return;
    if (used || !Buffer.isBuffer(chunk) || !chunk.length) { reject(); return; }
    timer ??= setTimeout(reject, receiveTimeoutMs);
    let position = 0;
    if (headerSize < 4) {
      const length = Math.min(4 - headerSize, chunk.length);
      chunk.copy(header, headerSize, 0, length); headerSize += length; position += length;
      if (headerSize < 4) return;
      const size = header.readUInt32BE();
      if (!size || size > SELECTED_RESTORE_MAX_BYTES) { reject(); return; }
      body = Buffer.alloc(size);
    }
    if (chunk.length - position > body.length - offset) { reject(); return; }
    offset += chunk.copy(body, offset, position);
    if (offset !== body.length) return;
    used = true; clearTimeout(timer);
    active = Promise.resolve().then(execute);
    active.catch(() => { /* stop() retains join failure; onFatal terminates composition. */ });
  });
  channel.on('error', close); channel.on('end', close); channel.on('close', close);
  return { async stop() { close(); await active; } };
}
