/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { gatewayModels, gatewayError, gatewayProviderIdentity, gatewayRoute, validateGatewayBody } from './contract.mjs';
import { readGatewayStream } from './stream.mjs';
import { gatewayClientTls, privateGatewayAddress } from './tls.mjs';
import { gatewayTaskSourceHeaders } from './taskSource.mjs';

/** Explicit server-side dependency, never loaded from user-facing settings. */
export function createGatewayClient(raw, { expectedUpstream }) {
  if (!raw || Object.keys(raw).some(key => !['url','upstream','models','token','ca'].includes(key))) throw gatewayError('gateway_client_config_invalid');
  let url;
  try { url = new URL(raw.url); } catch { throw gatewayError('gateway_client_config_invalid'); }
  const secure = url.protocol === 'https:';
  if (!(secure ? privateGatewayAddress(url.hostname) : url.protocol === 'http:' && url.hostname === '127.0.0.1' && raw.ca === undefined) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw gatewayError('gateway_client_config_invalid');
  const tls = secure ? gatewayClientTls(raw.ca) : {};
  const request = secure ? httpsRequest : httpRequest;
  if (typeof raw.token !== 'string' || !/^[a-zA-Z0-9_-]{43,128}$/.test(raw.token)) throw gatewayError('gateway_client_config_invalid');
  const config = { ...gatewayProviderIdentity(raw.upstream),models: gatewayModels(raw.models) };
  if (config.providerHash !== gatewayProviderIdentity(expectedUpstream).providerHash) throw gatewayError('gateway_provider_mismatch',409);
  const authorization = `Bearer ${raw.token}`, base = url.origin, active = new Set();
  let closed = false;
  return Object.freeze({
    async request(path, body, { signal = undefined, timeoutMs = 180000, maxResponseBytes = undefined, onRecord = undefined, source = undefined } = {}) {
      if (closed) throw gatewayError('gateway_client_closed');
      if (active.size >= 32) throw gatewayError('gateway_busy',429);
      const route = gatewayRoute(body === undefined ? 'GET' : 'POST',path);
      const sourceHeaders = gatewayTaskSourceHeaders(source,route.compute);
      if (body !== undefined) validateGatewayBody(path,body,config);
      const streaming = path === '/api/generate' && body?.stream === true;
      if (streaming !== (typeof onRecord === 'function') || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) {
        throw gatewayError('gateway_client_request_invalid',400);
      }
      const limit = path === '/api/embed' ? 4 * 1024 * 1024 : 1024 * 1024;
      const maxBytes = maxResponseBytes ?? limit;
      if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > limit || streaming && maxBytes !== limit) {
        throw gatewayError('gateway_client_request_invalid',400);
      }
      const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
      if (bytes?.length > 256 * 1024) throw gatewayError('gateway_body_limit',413);
      const controller = new AbortController();
      const combined = AbortSignal.any([controller.signal,...(signal ? [signal] : [])]);
      active.add(controller);
      const timer = setTimeout(() => controller.abort(),timeoutMs); timer.unref();
      try {
        combined.throwIfAborted();
        return await new Promise((resolve,reject) => {
          const req = request(`${base}${path}`,{ ...tls, method: bytes ? 'POST' : 'GET',signal: combined,agent: false,maxHeaderSize: 8192,
            headers: { ...sourceHeaders,Authorization: authorization,'X-Classifarr-Provider': config.providerHash,'Accept-Encoding': 'identity',
              ...(bytes ? { 'Content-Type': 'application/json','Content-Length': bytes.length } : {}) } }, res => {
            void (async () => {
              if (res.statusCode !== 200) throw gatewayError('gateway_request_rejected',res.statusCode);
              if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') throw gatewayError('gateway_response_invalid');
              if (streaming) {
                if (res.headers['content-type']?.split(';')[0].trim() !== 'application/x-ndjson') throw gatewayError('gateway_response_invalid');
                return readGatewayStream(res,body.model,onRecord,combined);
              }
              let length = 0; const chunks = [];
              for await (const chunk of res) {
                length += chunk.length;
                if (length > maxBytes) throw gatewayError('gateway_response_invalid');
                chunks.push(chunk);
              }
              combined.throwIfAborted();
              try { return JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(Buffer.concat(chunks))); }
              catch { throw gatewayError('gateway_response_invalid'); }
            })().then(resolve,error => { req.destroy(); reject(error); });
          });
          req.on('error',() => reject(gatewayError('gateway_transport_failed'))); req.end(bytes);
        });
      } catch (error) {
        if (combined.aborted) throw Object.assign(gatewayError('gateway_cancelled'),{ name: 'AbortError' });
        if (error?.message === 'gateway_request_rejected') throw gatewayError('gateway_request_rejected',error.status);
        throw gatewayError('gateway_transport_failed');
      } finally { clearTimeout(timer); active.delete(controller); }
    },
    close() { closed = true; for (const controller of active) controller.abort(); },
  });
}
