/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { request } from 'node:http';
import { gatewayError } from './contract.mjs';

/** No redirects, ambient proxy, forwarded headers, retries or arbitrary destination. */
export function gatewayUpstream(config, path, body, signal) {
  return new Promise((resolve,reject) => {
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const req = request(`${config.upstream}${path}`, { method: bytes ? 'POST' : 'GET', signal, agent: false,
      maxHeaderSize: 8192, headers: bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length,
        'Accept-Encoding': 'identity' } : { 'Accept-Encoding': 'identity' } }, res => {
      const chunks = []; let length = 0;
      const maxBytes = path === '/api/embed' ? 4 * 1024 * 1024 : 1024 * 1024;
      res.on('data', chunk => {
        length += chunk.length;
        if (length > maxBytes) req.destroy(gatewayError('gateway_response_invalid'));
        else chunks.push(chunk);
      });
      res.on('error', () => reject(gatewayError('gateway_upstream_unknown')));
      res.on('end', () => {
        const status = res.statusCode;
        // Only these complete responses establish a known rejection. Never relay error text.
        if ([400,401,403,404,429,503].includes(status)) { resolve({ status, rejected: true }); return; }
        if (status !== 200 || res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
          reject(gatewayError('gateway_upstream_unknown')); return;
        }
        try {
          const data = JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(Buffer.concat(chunks)));
          if (!data || typeof data !== 'object' || Array.isArray(data) || data.error || data.remote_host || data.remote_model ||
              (path === '/api/generate' && (data.done !== true || data.model !== body.model || typeof data.response !== 'string')) ||
              (path === '/api/embed' && (data.model !== body.model || !Array.isArray(data.embeddings) ||
                data.embeddings.length !== (Array.isArray(body.input) ? body.input.length : 1) ||
                data.embeddings.some(vector => !Array.isArray(vector) || !vector.length || vector.length > 16000 ||
                  vector.some(value => !Number.isFinite(value)))))) throw gatewayError('gateway_response_invalid');
          resolve({ status, data });
        } catch { reject(gatewayError('gateway_response_invalid')); }
      });
    });
    req.on('error', () => reject(gatewayError('gateway_upstream_unknown')));
    req.end(bytes);
  });
}
