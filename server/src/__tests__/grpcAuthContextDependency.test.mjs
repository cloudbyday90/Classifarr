/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { TLSSocket } from 'node:tls';
import { jest } from '@jest/globals';
import { BaseServerInterceptingCall } from '@grpc/grpc-js/build/src/server-interceptors.js';

// Exercise the real dependency's authorization boundary without expiring test
// certificates. These are socket-state tests, not TLS handshake verification.
function authContext(socket) {
  return BaseServerInterceptingCall.prototype.getAuthContext.call({
    stream: { session: { socket } },
  });
}

describe('gRPC peer identity security boundary (GHSA-m9gg-hp2v-232j)', () => {
  test.each([
    ['untrusted certificate', { raw: Buffer.from('untrusted'), subject: { CN: 'synthetic-admin' } }],
    ['no certificate', {}],
  ])('does not expose an unauthorized peer with %s', (_label, certificate) => {
    const socket = new TLSSocket();
    try {
      socket.authorized = false;
      socket.getPeerCertificate = jest.fn(() => certificate);
      expect(authContext(socket)).toEqual({});
      expect(socket.getPeerCertificate).not.toHaveBeenCalled();
    } finally {
      socket.destroy();
    }
  });

  test('preserves an authorized peer identity', () => {
    const socket = new TLSSocket();
    const certificate = { raw: Buffer.from('trusted'), subject: { CN: 'synthetic-client' } };
    socket.authorized = true;
    socket.getPeerCertificate = () => certificate;
    try {
      expect(authContext(socket)).toEqual({
        transportSecurityType: 'ssl', sslPeerCertificate: certificate,
      });
    } finally {
      socket.destroy();
    }
  });

  test.each([undefined, {}, { authorized: true, getPeerCertificate: () => ({ raw: 'fake' }) }])(
    'does not treat a non-TLS socket as authenticated', socket => {
      expect(authContext(socket)).toEqual({});
    },
  );
});
