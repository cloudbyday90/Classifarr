/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './contract.mjs';

/** One active gateway owns this in-memory queue. Durable uncertainty lives in PostgreSQL. */
export function createGatewayAdmission({ queueMs }) {
  let active = false, stopped = false;
  const waiting = [];
  function drain() {
    if (active || stopped) return;
    const next = waiting.shift();
    if (!next) return;
    next.cleanup(); next.resolve(grant());
  }
  function grant() {
    active = true; let released = false;
    return () => { if (released) return; released = true; active = false; drain(); };
  }
  return {
    acquire(principal, signal) {
      if (stopped || signal.aborted) return Promise.reject(gatewayError('gateway_cancelled'));
      if (!active && waiting.length === 0) return Promise.resolve(grant());
      if (principal.workClass !== 'foreground' || waiting.length >= 8 ||
          waiting.some(entry => entry.installation === principal.installation)) {
        return Promise.reject(gatewayError('gateway_busy', 429));
      }
      return new Promise((resolve,reject) => {
        const entry = { installation: principal.installation, resolve, reject, cleanup: () => {
          clearTimeout(timer); signal.removeEventListener('abort', cancel);
        } };
        const cancel = () => {
          const index = waiting.indexOf(entry);
          if (index < 0) return;
          waiting.splice(index,1); entry.cleanup(); reject(gatewayError('gateway_cancelled'));
        };
        const timer = setTimeout(cancel,queueMs); timer.unref();
        waiting.push(entry); signal.addEventListener('abort',cancel,{ once: true });
        if (signal.aborted) cancel();
      });
    },
    stop() { stopped = true; for (const entry of [...waiting]) { entry.cleanup(); entry.reject(gatewayError('gateway_cancelled')); } waiting.length = 0; },
    get pending() { return waiting.length; },
  };
}
