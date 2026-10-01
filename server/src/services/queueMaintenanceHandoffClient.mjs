/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Socket } from 'node:net';
import { performance } from 'node:perf_hooks';
import { QUEUE_MAINTENANCE_REQUEST, QUEUE_MAINTENANCE_INTERVAL_MS,
  QUEUE_MAINTENANCE_RESULTS } from '../utils/queueMaintenanceHandoffProtocol.mjs';

export function createQueueMaintenanceHandoffClient({ channel, now = () => performance.now() }) {
  let closed = false, pending = null, last = -Infinity, settle, timer;
  const finish = status => {
    clearTimeout(timer);
    const resolve = settle;
    settle = null; pending = null;
    resolve?.({ status, via: 'maintenance_handoff' });
  };
  const close = () => { if (!closed) { closed = true; channel.destroy(); } finish('unavailable'); };
  channel.on('error', close);
  channel.on('end', close);
  channel.on('close', close);
  channel.on('data', chunk => {
    if (!pending || !Buffer.isBuffer(chunk) || chunk.length !== 1 || !Object.hasOwn(QUEUE_MAINTENANCE_RESULTS, chunk[0])) close();
    else finish(QUEUE_MAINTENANCE_RESULTS[chunk[0]]);
  });
  channel.unref?.();
  return { close, request() {
    if (closed) return Promise.resolve({ status: 'unavailable', via: 'maintenance_handoff' });
    if (pending) return pending;
    if (now() - last < QUEUE_MAINTENANCE_INTERVAL_MS) return Promise.resolve({ status: 'deferred', via: 'maintenance_handoff' });
    last = now();
    pending = new Promise(resolve => { settle = resolve; });
    const result = pending;
    timer = setTimeout(close, 95_000); timer.unref?.();
    try { if (!channel.write(Buffer.from([QUEUE_MAINTENANCE_REQUEST]), error => { if (error) close(); })) close(); }
    catch { close(); }
    return result;
  } };
}

/** A flag selects an already-inherited capability; it cannot create administrator authority. */
export function openQueueMaintenanceHandoff({ environment = process.env, platform = process.platform,
  connect = () => new Socket({ fd: 3, readable: true, writable: true }),
} = {}) {
  if (environment.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL !== 'stdio-v1') return null;
  if (platform !== 'linux') return { request: async () => ({ status: 'unavailable', via: 'maintenance_handoff' }) };
  try { return createQueueMaintenanceHandoffClient({ channel: connect() }); }
  catch { return { request: async () => ({ status: 'unavailable', via: 'maintenance_handoff' }) }; }
}
