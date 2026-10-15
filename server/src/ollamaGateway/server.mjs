/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { gatewayError, gatewayRoute, validateGatewayBody } from './contract.mjs';
import { createGatewayCredentials } from './credentials.mjs';
import { createGatewayAdmission } from './admission.mjs';
import { gatewayUpstream } from './transport.mjs';
import { executeGatewayCompute } from './execution.mjs';
import { writeGatewayRecord } from './stream.mjs';
import { readGatewayTaskSource } from './taskSource.mjs';

function readBody(req, signal) {
  return new Promise((resolve,reject) => {
    const chunks = []; let length = 0;
    const cleanup = () => {
      req.removeListener('data',data); req.removeListener('end',end); req.removeListener('error',abort);
      signal.removeEventListener('abort',abort);
    };
    const abort = () => { cleanup(); req.pause(); reject(gatewayError('gateway_cancelled')); };
    const data = chunk => {
      length += chunk.length;
      if (length > 256 * 1024) { cleanup(); req.pause(); reject(gatewayError('gateway_body_limit',413)); }
      else chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try { resolve(JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { reject(gatewayError('gateway_body_invalid',400)); }
    };
    req.on('data',data); req.once('end',end); req.once('error',abort);
    signal.addEventListener('abort',abort,{ once: true });
    if (signal.aborted) abort();
  });
}

/** Authentication is server-to-server only. No app sessions, cookies or CORS. */
export function createGatewayServer({ config, ledger }) {
  const admission = createGatewayAdmission(config), shutdown = new AbortController();
  const credentials = createGatewayCredentials(config);
  let handling = 0, credits = 120, windowStart = Date.now();
  const options = { maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 5000 };
  const server = config.tls ? createHttpsServer({ ...config.tls, ...options }) : createHttpServer(options);
  server.on('request', (req,res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),config.timeoutMs); timer.unref();
    let signal = AbortSignal.any([controller.signal,shutdown.signal]);
    req.on('error', () => controller.abort());
    res.on('error', () => controller.abort());
    res.on('close', () => controller.abort());
    res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type','application/json');
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Connection','close');
    const send = (status,data) => {
      if (!res.destroyed && !res.writableEnded) { res.statusCode = status; res.end(JSON.stringify(data)); }
    };
    if (Date.now() - windowStart >= 60000) { credits = 120; windowStart = Date.now(); }
    if (--credits < 0 || handling >= 32) { clearTimeout(timer); send(429,{ error: 'gateway_busy' }); return; }
    handling++;
    void (async () => {
      let release, authority;
      try {
        signal.throwIfAborted();
        const authCount = req.rawHeaders.filter((_,index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === 'authorization').length;
        authority = credentials.acquire(authCount === 1 ? req.headers.authorization : null);
        const { principal } = authority;
        signal = AbortSignal.any([signal,authority.signal]);
        if (req.headers['x-classifarr-provider'] !== undefined && req.headers['x-classifarr-provider'] !== config.providerHash) {
          throw gatewayError('gateway_provider_mismatch',409);
        }
        const route = gatewayRoute(req.method,req.url);
        const source = readGatewayTaskSource(req,route.compute);
        if (req.headers['content-encoding'] || req.headers['content-length'] && Number(req.headers['content-length']) > 256 * 1024) {
          throw gatewayError('gateway_body_limit',413);
        }
        if (req.method === 'GET' && (req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) !== 0)) {
          throw gatewayError('gateway_body_invalid',400);
        }
        if (route.history) {
          const history = await ledger.history(principal.installation,route.history); signal.throwIfAborted();
          send(200,history); return;
        }
        if (req.url === '/gateway/status') {
          const status = await ledger.status(); signal.throwIfAborted();
          send(200,{ ...status,waiting: admission.pending }); return;
        }
        let body;
        if (req.method === 'POST') {
          const contentType = (req.headers['content-type'] || '').toLowerCase().replaceAll(' ','');
          if (!['application/json','application/json;charset=utf-8'].includes(contentType)) throw gatewayError('gateway_body_invalid',400);
          body = validateGatewayBody(req.url,await readBody(req,signal),config);
        }
        const onRecord = async data => {
          if (!res.headersSent) res.setHeader('Content-Type','application/x-ndjson');
          await writeGatewayRecord(res,data,signal);
        };
        let result;
        if (route.compute) {
          release = await admission.acquire(principal,signal); signal.throwIfAborted();
          result = await executeGatewayCompute({ ledger,installation: principal.installation,
            config,path: req.url,body,signal,onRecord,source });
        } else {
          if ((await ledger.status()).state === 'maintenance') throw gatewayError('gateway_admission_deferred');
          signal.throwIfAborted();
          result = await gatewayUpstream(config,req.url,body,signal,onRecord);
        }
        signal.throwIfAborted();
        if (result.streamed) {
          if (!res.headersSent) res.setHeader('Content-Type','application/x-ndjson');
          await writeGatewayRecord(res,result.data,signal); res.end();
        } else if (result.rejected) {
          if ([429,503].includes(result.status)) res.setHeader('Retry-After','5');
          send(result.status,{ error: 'gateway_upstream_rejected' });
        } else send(200,result.data);
      } catch (error) {
        const known = typeof error?.code === 'string' && /^gateway_[a-z_]+$/.test(error.code);
        if (res.headersSent) res.destroy();
        else send(known ? error.status : 503,{ error: known ? error.code : 'gateway_unavailable' });
      } finally { authority?.release(); release?.(); handling--; clearTimeout(timer); }
    })();
  });
  server.maxConnections = 64; server.keepAliveTimeout = 1000; server.maxRequestsPerSocket = 1;
  server.on('clientError', (_error,socket) => { socket.destroy(); });
  server.on('checkContinue', (_req,res) => { res.writeHead(417,{ Connection: 'close' }); res.end(); });
  server.on('connect', (_req,socket) => { socket.destroy(); });
  return { server, replaceCredentials: next => credentials.replace(next), async stop() {
    credentials.stop(); admission.stop(); shutdown.abort();
    const closing = new Promise(resolve => { server.close(resolve); });
    server.closeAllConnections(); await closing;
  } };
}
