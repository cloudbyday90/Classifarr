/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { X509Certificate } from 'node:crypto';
import { createSecureContext } from 'node:tls';
import { isIP } from 'node:net';

const invalid = () => new Error('gateway_tls_config_invalid');
export function privateGatewayAddress(value) {
  const octets = typeof value === 'string' ? value.split('.').map(Number) : [];
  return isIP(value ?? '') === 4 && (octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
}
function certificate(value) {
  if (typeof value !== 'string' || value.length > 16384 || !value.startsWith('-----BEGIN CERTIFICATE-----')) throw invalid();
  try { return new X509Certificate(value); } catch { throw invalid(); }
}
export function gatewayClientTls(ca) {
  if (!certificate(ca).ca) throw invalid();
  return Object.freeze({ ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' });
}
export function gatewayServerTls(raw, host) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(key => !['cert', 'key'].includes(key)) || typeof raw.key !== 'string' || raw.key.length > 16384 ||
      !certificate(raw.cert).checkIP(host)) throw invalid();
  const options = { cert: raw.cert, key: raw.key, minVersion: /** @type {const} */ ('TLSv1.2'), handshakeTimeout: 5000 };
  try { createSecureContext(options); } catch { throw invalid(); }
  return Object.freeze(options);
}
