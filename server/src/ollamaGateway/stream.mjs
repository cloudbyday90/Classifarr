/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { once } from 'node:events';
import { gatewayError } from './contract.mjs';

function deliverRecord(onRecord, data, signal) {
  return new Promise((resolve,reject) => {
    const abort = () => { reject(gatewayError('gateway_cancelled')); };
    signal.addEventListener('abort',abort,{ once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return onRecord(data); }).then(resolve,reject)
      .finally(() => signal.removeEventListener('abort',abort));
    if (signal.aborted) abort();
  });
}

/** Bounded NDJSON reader. Completion is returned only after a clean EOF. */
export async function readGatewayStream(source, model, onRecord, signal) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '', bytes = 0, records = 0, final = null;
  async function line(value) {
    if (!value.trim()) return;
    if (final || Buffer.byteLength(value) > 65536 || ++records > 8192) throw gatewayError('gateway_response_invalid');
    let data;
    try { data = JSON.parse(value); } catch { throw gatewayError('gateway_response_invalid'); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.model !== model ||
        typeof data.done !== 'boolean' || ['error','remote_host','remote_model'].some(key => Object.hasOwn(data,key)) ||
        (data.response !== undefined && typeof data.response !== 'string') ||
        (data.thinking !== undefined && typeof data.thinking !== 'string') ||
        (typeof data.response !== 'string' && typeof data.thinking !== 'string')) throw gatewayError('gateway_response_invalid');
    if (data.done) final = data;
    else { signal.throwIfAborted(); await deliverRecord(onRecord,data,signal); }
  }
  for await (const chunk of source) {
    signal.throwIfAborted(); bytes += chunk.byteLength;
    if (bytes > 1024 * 1024) throw gatewayError('gateway_response_invalid');
    try { pending += decoder.decode(chunk,{ stream: true }); } catch { throw gatewayError('gateway_response_invalid'); }
    let end;
    while ((end = pending.indexOf('\n')) !== -1) {
      const value = pending.slice(0,end); pending = pending.slice(end+1); await line(value);
    }
    if (Buffer.byteLength(pending) > 65536) throw gatewayError('gateway_response_invalid');
  }
  try { pending += decoder.decode(); } catch { throw gatewayError('gateway_response_invalid'); }
  await line(pending); signal.throwIfAborted();
  if (!final) throw gatewayError('gateway_response_invalid');
  return final;
}

/** Await downstream capacity, bounded by the caller's total request deadline. */
export async function writeGatewayRecord(destination, data, signal) {
  signal.throwIfAborted();
  if (destination.destroyed || destination.writableEnded) throw gatewayError('gateway_cancelled');
  if (!destination.write(`${JSON.stringify(data)}\n`)) await once(destination,'drain',{ signal });
}
