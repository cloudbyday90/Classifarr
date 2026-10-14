/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { gatewayError } from './contract.mjs';

/** One bounded read and one coalesced follow-up; shutdown fences late reads. */
export function createGatewayConfigurationReload({ initial,load,apply,onReload,onFailure }) {
  let running = null, pending = false, stopped = false;
  const shutdown = new AbortController();
  async function read() {
    let timer, cancel;
    const interrupted = new Promise((_,reject) => {
      cancel = () => reject(gatewayError('gateway_cancelled'));
      shutdown.signal.addEventListener('abort',cancel,{ once: true });
      timer = setTimeout(() => reject(gatewayError('gateway_reload_timeout')),5000); timer.unref();
    });
    try { return await Promise.race([Promise.resolve().then(load),interrupted]); }
    finally { clearTimeout(timer); shutdown.signal.removeEventListener('abort',cancel); }
  }
  async function drain() {
    try {
      while (pending && !stopped) {
        pending = false;
        const candidate = await read();
        if (stopped) return;
        if (!isDeepStrictEqual(initial.database,candidate.database)) throw gatewayError('gateway_reload_incompatible');
        apply(candidate.config); onReload();
      }
    } catch {
      if (!stopped) {
        stopped = true; pending = false;
        await onFailure(); // Fixed diagnostic and fail-closed shutdown; never log the exception.
      }
    } finally { running = null; }
  }
  return {
    reload() {
      if (stopped) return Promise.resolve();
      pending = true;
      if (!running) running = drain();
      return running;
    },
    stop() { stopped = true; pending = false; shutdown.abort(); },
  };
}
