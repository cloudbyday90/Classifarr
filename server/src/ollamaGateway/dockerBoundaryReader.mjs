/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { request } from 'node:http';
import { gatewayError } from './contract.mjs';

// No caller-defined method, route, headers, proxy, credentials or TCP fallback.
export function createDockerBoundaryReader(config, signal) {
  const routes = { version: '/version',info: '/v1.51/info',container: `/v1.51/containers/${config.containerId}/json` };
  return async kind => {
    if (!Object.hasOwn(routes,kind)) throw gatewayError('gateway_boundary_unavailable');
    const deadline = AbortSignal.timeout(3000);
    const bounded = AbortSignal.any([signal,deadline]);
    return new Promise((resolve,reject) => {
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        reject(gatewayError('gateway_boundary_unavailable'));
      };
      const req = request({ socketPath: config.socketPath,path: routes[kind],method: 'GET',
        agent: false,signal: bounded,maxHeaderSize: 8192,headers: { Accept: 'application/json' } },res => {
        const parts = []; let bytes = 0;
        const refuse = () => { fail(); res.destroy(); req.destroy(); };
        res.on('error',fail);
        if (res.statusCode !== 200 || !/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] || '') ||
            (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) { refuse(); return; }
        res.on('data',part => {
          bytes += part.length;
          if (bytes > 262144) { refuse(); return; }
          parts.push(part);
        });
        res.on('end',() => {
          if (settled) return;
          try {
            if (!res.complete) throw new Error();
            const value = JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(Buffer.concat(parts)));
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
            settled = true; resolve(value);
          } catch { refuse(); }
        });
        res.on('close',() => { if (!res.complete) fail(); });
      });
      req.on('error',fail);
      req.end();
    });
  };
}
