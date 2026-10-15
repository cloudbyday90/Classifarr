/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash, X509Certificate } from 'node:crypto';
import { checkServerIdentity } from 'node:tls';
import { gatewayClientTls } from './tls.mjs';
import { gatewayError } from './errors.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

export function gatewayUpstreamTls(upstream, raw) {
  if (new URL(upstream).protocol === 'http:') {
    if (raw !== undefined) throw gatewayError('gateway_config_invalid');
    return undefined;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 2 ||
      !Object.hasOwn(raw,'ca') || !Object.hasOwn(raw,'publicKeySha256') ||
      typeof raw.publicKeySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(raw.publicKeySha256)) {
    throw gatewayError('gateway_config_invalid');
  }
  return Object.freeze({ ...gatewayClientTls(raw.ca),publicKeySha256: raw.publicKeySha256 });
}

/** These hashes identify a TLS peer, not its Docker process or proxy target. */
export function gatewayPeerIdentity(raw) {
  const certificate = new X509Certificate(raw);
  return Object.freeze({ publicKeySha256: digest(certificate.publicKey.export({ type: 'spki',format: 'der' })),
    certificateSha256: digest(certificate.raw) });
}

export function gatewayUpstreamTlsOptions(config) {
  if (!config.upstreamTls) return {};
  const { publicKeySha256,...tls } = config.upstreamTls;
  return { ...tls, checkServerIdentity(host,certificate) {
    try {
      if (checkServerIdentity(host,certificate) || gatewayPeerIdentity(certificate.raw).publicKeySha256 !== publicKeySha256) {
        return gatewayError('gateway_upstream_identity_failed');
      }
    } catch { return gatewayError('gateway_upstream_identity_failed'); }
  } };
}

/** No HTTP bytes until verification and the optional durable evidence write finish. */
export function dispatchGatewayUpstream(req,{ config,signal,bytes,onPeer,onDispatch }) {
  const send = () => {
    signal.throwIfAborted();
    if (req.destroyed) throw gatewayError('gateway_upstream_unknown');
    onDispatch(); req.end(bytes);
  };
  if (!config.upstreamTls) { send(); return; }
  const timer = setTimeout(() => req.destroy(gatewayError('gateway_upstream_identity_failed')),5000);
  timer.unref(); req.once('close',() => clearTimeout(timer));
  req.once('socket',socket => {
    socket.once('secureConnect',() => {
      clearTimeout(timer);
      void (async () => {
        signal.throwIfAborted();
        if (!socket.authorized) throw gatewayError('gateway_upstream_identity_failed');
        const peer = gatewayPeerIdentity(socket.getPeerCertificate().raw);
        if (peer.publicKeySha256 !== config.upstreamTls.publicKeySha256) throw gatewayError('gateway_upstream_identity_failed');
        await onPeer(peer);
        send();
      })().catch(() => req.destroy(gatewayError('gateway_upstream_unknown')));
    });
  });
}
