/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export const gatewayError = (code, status = 503) => Object.assign(new Error(code), { code, status });
const hash = value => createHash('sha256').update(value).digest();
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const modelPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,199}$/;

export function gatewayProviderIdentity(value) {
  let upstream;
  try { upstream = new URL(value); } catch { throw gatewayError('gateway_config_invalid'); }
  const octets = upstream.hostname.split('.').map(Number);
  const privateIp = isIP(upstream.hostname) === 4 && (octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  if (!privateIp || upstream.protocol !== 'http:' || upstream.username || upstream.password ||
      upstream.pathname !== '/' || upstream.search || upstream.hash) throw gatewayError('gateway_config_invalid');
  return { upstream: upstream.origin,providerHash: hash(upstream.origin).toString('hex') };
}

export function gatewayConfig(raw) {
  if (!record(raw) || Object.keys(raw).some(key => !['upstream','port','models','credentials','timeoutMs','queueMs'].includes(key))) {
    throw gatewayError('gateway_config_invalid');
  }
  const identity = gatewayProviderIdentity(raw.upstream);
  if (!Array.isArray(raw.models) || raw.models.length < 1 || raw.models.length > 16 ||
      raw.models.some(model => typeof model !== 'string' || !modelPattern.test(model) || !model.includes(':') || /cloud/i.test(model)) ||
      new Set(raw.models).size !== raw.models.length) throw gatewayError('gateway_config_invalid');
  const credentials = raw.credentials;
  if (!Array.isArray(credentials) || credentials.length < 1 || credentials.length > 32 || credentials.some(entry =>
    !record(entry) || Object.keys(entry).some(key => !['installation','workClass','token'].includes(key)) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(entry.installation ?? '') ||
    !['foreground','background'].includes(entry.workClass) ||
    typeof entry.token !== 'string' || !/^[a-zA-Z0-9_-]{43,128}$/.test(entry.token)) ||
    new Set(credentials.map(entry => entry.token)).size !== credentials.length) throw gatewayError('gateway_config_invalid');
  const port = raw.port ?? 11435, timeoutMs = raw.timeoutMs ?? 180000, queueMs = raw.queueMs ?? 5000;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000 ||
      !Number.isInteger(queueMs) || queueMs < 1 || queueMs > 30000 || queueMs >= timeoutMs) throw gatewayError('gateway_config_invalid');
  return Object.freeze({ ...identity, port, timeoutMs, queueMs,
    models: Object.freeze([...raw.models]), credentials: Object.freeze(credentials.map(entry => Object.freeze({
      installation: entry.installation, workClass: entry.workClass, digest: hash(entry.token),
    }))) });
}

export function authenticateGateway(config, authorization) {
  if (typeof authorization !== 'string' || !/^Bearer [a-zA-Z0-9_-]{43,128}$/.test(authorization)) return null;
  const digest = hash(authorization.slice(7));
  let match = null;
  for (const entry of config.credentials) if (timingSafeEqual(digest, entry.digest)) match = entry;
  return match;
}

export function gatewayRoute(method, path) {
  if (method === 'GET' && ['/api/tags','/api/ps','/api/version','/gateway/status'].includes(path)) return { compute: false };
  if (method === 'POST' && ['/api/generate','/api/embed','/api/show'].includes(path)) return { compute: path !== '/api/show' };
  throw gatewayError('gateway_route_rejected', 404);
}

export function validateGatewayBody(path, body, config) {
  if (!record(body) || !config.models.includes(body.model)) throw gatewayError('gateway_body_invalid', 400);
  const allowed = path === '/api/generate' ? ['model','prompt','stream','format','options','think','keep_alive']
    : path === '/api/embed' ? ['model','input','truncate','keep_alive'] : ['model','verbose'];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw gatewayError('gateway_body_invalid', 400);
  if (path === '/api/generate' && (typeof body.stream !== 'boolean' || typeof body.prompt !== 'string' || !body.prompt.length)) {
    throw gatewayError('gateway_body_invalid', 400);
  }
  if (body.keep_alive !== undefined && ![0,'0','5m',300].includes(body.keep_alive)) throw gatewayError('gateway_body_invalid', 400);
  if (body.think !== undefined && typeof body.think !== 'boolean' && !['low','medium','high','max'].includes(body.think)) {
    throw gatewayError('gateway_body_invalid', 400);
  }
  if (body.format !== undefined && body.format !== 'json' && !record(body.format)) throw gatewayError('gateway_body_invalid', 400);
  if (body.options !== undefined) {
    const limits = { temperature: [0,2], seed: [0,2147483647], num_ctx: [1,65536], num_predict: [1,4096] };
    if (!record(body.options) || Object.entries(body.options).some(([key,value]) => !Object.hasOwn(limits,key) ||
        !Number.isFinite(value) || value < limits[key][0] || value > limits[key][1] ||
        (key !== 'temperature' && !Number.isInteger(value)))) throw gatewayError('gateway_body_invalid', 400);
  }
  if (body.verbose !== undefined && body.verbose !== false) throw gatewayError('gateway_body_invalid', 400);
  if (body.truncate !== undefined && typeof body.truncate !== 'boolean') throw gatewayError('gateway_body_invalid', 400);
  if (path === '/api/embed') {
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    if (!inputs.length || inputs.length > 8 || inputs.some(input => typeof input !== 'string' || !input.length)) {
      throw gatewayError('gateway_body_invalid', 400);
    }
  }
  return body;
}
