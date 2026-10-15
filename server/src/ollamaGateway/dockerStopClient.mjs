/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { request } from 'node:http';
import { gatewayError } from './errors.mjs';

/** Separate from the read-only observer: exactly one allowlisted mutation, no retries. */
export function createDockerStopClient(config,signal) {
  const routes = { version: '/version',info: '/v1.51/info',
    container: `/v1.51/containers/${config.boundary.containerId}/json`,network: `/v1.51/networks/${config.networkId}`,
    stop: `/v1.51/containers/${config.boundary.containerId}/stop?t=5` };
  let stopSent = false;
  return async kind => {
    if (!Object.hasOwn(routes,kind) || kind === 'stop' && stopSent) throw gatewayError('gateway_stop_operation_refused');
    signal.throwIfAborted();
    if (kind === 'stop') stopSent = true;
    const bounded = AbortSignal.any([signal,AbortSignal.timeout(kind === 'stop' ? 8000 : 3000)]);
    return new Promise((resolve,reject) => {
      const fail = () => reject(gatewayError('gateway_stop_docker_unavailable'));
      const req = request({ socketPath: config.boundary.socketPath,path: routes[kind],method: kind === 'stop' ? 'POST' : 'GET',
        agent: false,signal: bounded,maxHeaderSize: 8192,headers: { Accept: 'application/json' } },res => {
        const parts = []; let bytes = 0;
        const refuse = () => { fail(); res.destroy(); req.destroy(); };
        res.on('error',fail);
        if (kind === 'stop' ? ![204,304].includes(res.statusCode) : res.statusCode !== 200 ||
            !/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] || '')) { refuse(); return; }
        if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { refuse(); return; }
        res.on('data',part => {
          bytes += part.length;
          if (bytes > 262144 || kind === 'stop' && bytes) { refuse(); return; }
          parts.push(part);
        });
        res.on('end',() => {
          try {
            if (!res.complete) throw new Error();
            if (kind === 'stop') { resolve(null); return; }
            const value = JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(Buffer.concat(parts)));
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
            resolve(value);
          } catch { refuse(); }
        });
        res.on('close',() => { if (!res.complete) fail(); });
      });
      req.on('error',fail); req.end();
    });
  };
}
