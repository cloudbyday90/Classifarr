/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { gatewayError } from './contract.mjs';
import { readGatewayStream } from './stream.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { dispatchGatewayUpstream, gatewayUpstreamTlsOptions } from './upstreamIdentity.mjs';
import { gatewayWorkHeaders } from './workIdentity.mjs';

/** No redirects, ambient proxy, forwarded headers, retries or arbitrary destination. */
export function gatewayUpstream(config, path, body, signal, onRecord = async (_data) => {},
  { onPeer = async (_peer) => {},requestIdentity = undefined } = {}) {
  return new Promise((resolve,reject) => {
    let dispatched = false;
    const request = config.upstreamTls ? httpsRequest : httpRequest;
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    const headers = { ...gatewayWorkHeaders(requestIdentity),'Accept-Encoding': 'identity',
      ...(bytes ? { 'Content-Type': 'application/json','Content-Length': bytes.length } : {}) };
    const req = request(`${config.upstream}${path}`, { ...gatewayUpstreamTlsOptions(config),method: bytes ? 'POST' : 'GET', signal, agent: false,
      maxHeaderSize: 8192, headers }, res => {
      if (!dispatched) { req.destroy(); reject(gatewayError('gateway_upstream_unknown')); return; }
      if (path === '/api/generate' && body?.stream === true && res.statusCode === 200) {
        if (res.headers['content-type']?.split(';')[0].trim() !== 'application/x-ndjson' ||
            res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
          req.destroy(); reject(gatewayError('gateway_response_invalid')); return;
        }
        void readGatewayStream(res,body.model,onRecord,signal).then(data => {
          if (!res.complete) { reject(gatewayError('gateway_upstream_unknown')); return; }
          resolve({ status: 200,data,streamed: true });
        }, () => { req.destroy(); reject(gatewayError('gateway_upstream_unknown')); });
        return;
      }
      const chunks = []; let length = 0;
      const maxBytes = path === '/api/embed' ? 4 * 1024 * 1024 : 1024 * 1024;
      res.on('data', chunk => {
        length += chunk.length;
        if (length > maxBytes) req.destroy(gatewayError('gateway_response_invalid'));
        else chunks.push(chunk);
      });
      res.on('error', () => reject(gatewayError('gateway_upstream_unknown')));
      res.on('end', () => {
        if (!res.complete) { reject(gatewayError('gateway_upstream_unknown')); return; }
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
              (path === '/api/generate' && body.prompt === '' && (data.response !== '' ||
                (data.thinking !== undefined && data.thinking !== '') ||
                (data.done_reason !== undefined && data.done_reason !== 'load'))) ||
              (path === '/api/embed' && (data.model !== body.model || !Array.isArray(data.embeddings) ||
                data.embeddings.length !== (Array.isArray(body.input) ? body.input.length : 1) ||
                data.embeddings.some(vector => !Array.isArray(vector) || !vector.length || vector.length > 16000 ||
                  vector.some(value => !Number.isFinite(value)))))) throw gatewayError('gateway_response_invalid');
          if (path === '/api/embed') {
            for (const vector of data.embeddings) validateEmbedding(vector, data.embeddings[0].length);
          }
          resolve({ status, data });
        } catch { reject(gatewayError('gateway_response_invalid')); }
      });
    });
    req.on('error', () => reject(gatewayError('gateway_upstream_unknown')));
    dispatchGatewayUpstream(req,{ config,signal,bytes,onPeer,onDispatch: () => { dispatched = true; } });
  });
}
