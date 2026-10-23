/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { Resolver } from 'node:dns/promises';
import { checkServerIdentity } from 'node:tls';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';

test('DNS rejects embedded NUL input before attempting resolution', async () => {
  const resolver = new Resolver({ timeout: 50, tries: 1 });
  // No upstream DNS servers: the fixture cannot send a query externally.
  resolver.setServers([]);
  await expect(Promise.resolve().then(() => resolver.resolve4('synthetic.invalid\0ignored'))).rejects.toMatchObject({
    code: 'ERR_INVALID_ARG_VALUE',
  });
});

test.each(['127.0.0.1', '127.1', '2130706433', '0177.0.0.1', '１２７.０.０.１'])(
  'TLS cannot authenticate an IP-like host with its matching DNS SAN: %s', host => {
    expect(checkServerIdentity(host, { subjectaltname: `DNS:${host}` })).toMatchObject({
      code: 'ERR_TLS_CERT_ALTNAME_INVALID',
    });
  },
);

test('TLS preserves canonical IP SAN and ordinary DNS SAN verification', () => {
  expect(checkServerIdentity('127.0.0.1', { subjectaltname: 'IP Address:127.0.0.1' })).toBeUndefined();
  expect(checkServerIdentity('synthetic.invalid', { subjectaltname: 'DNS:synthetic.invalid' })).toBeUndefined();
  expect(checkServerIdentity('wrong.invalid', { subjectaltname: 'DNS:synthetic.invalid' })).toMatchObject({
    code: 'ERR_TLS_CERT_ALTNAME_INVALID',
  });
});

test('bounded Brotli smoke preserves a normal payload and rejects a truncated stream', () => {
  // Ordinary compatibility data, not an exploit fixture or a proof of CVE remediation.
  const payload = Buffer.from('Classifarr synthetic runtime payload 😀'.repeat(4));
  const compressed = brotliCompressSync(payload);
  expect(brotliDecompressSync(compressed, { maxOutputLength: 1024 })).toEqual(payload);
  expect(() => brotliDecompressSync(compressed.subarray(0, 2), { maxOutputLength: 1024 })).toThrow();
});
