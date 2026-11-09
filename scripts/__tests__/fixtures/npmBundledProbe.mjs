/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer as httpsServer } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';
import { npmContext, loopback } from '../helpers/npmFixture.mjs';
import { gatewayTlsFixture } from '../../../server/src/__tests__/helpers/gatewayTlsFixture.mjs';
const context = npmContext(process.argv[2]), mode = process.argv[3];

if (mode === 'parser') {
  const require = createRequire(context.parser), { Address4, Address6 } = require('ip-address');
  const constants = require(resolve(dirname(context.parser), 'v6/constants.js'));
  const original = constants.RE_ZONE_STRING.exec;
  let legacy = 0;
  constants.RE_ZONE_STRING.exec = () => { legacy++; throw new Error('legacy_zone_matcher_reached'); };
  try {
    for (const code of [10, 13, 0x2028, 0x2029]) {
      const input = '%'.repeat(2048) + String.fromCodePoint(code) + 'x';
      for (const operation of [() => new Address6(input),
        () => Address6.fromAddressAndMask(input, 'ffff:ffff:ffff:ffff::'),
        () => Address6.fromAddressAndMask('fe80::1', input),
        () => Address6.fromAddressAndWildcardMask(input, '::ffff:ffff:ffff:ffff'),
        () => Address6.fromAddressAndWildcardMask('fe80::1', input),
        () => Address6.fromAddress4Nat64('192.0.2.1', input),
        () => new Address6('64:ff9b::c000:201').toAddress4Nat64(input)]) assert.throws(operation, { name: 'AddressError' });
      assert.equal(Address6.isValid(input), false);
    }
    assert.equal(legacy, 0);
    for (const input of ['fe80::1%eth0/64', 'fe80::1/64%eth0']) {
      const value = new Address6(input); assert.equal(value.zone, '%eth0'); assert.equal(value.subnetMask, 64);
    }
    assert.equal(new Address6('fe80::1%' + 'a'.repeat(8192)).correctForm(), 'fe80::1');
    assert.equal(new Address6('2001:db8::1').isInSubnet(new Address6('2001:db8::/32')), true);
    assert.equal(Address4.fromArpa('42.2.0.192.IN-ADDR.ARPA.').correctForm(), '192.0.2.42');
    const originalSplit = String.prototype.split; let splits = 0;
    String.prototype.split = function (...args) { splits++; return originalSplit.apply(this, args); };
    try { assert.throws(() => Address4.fromArpa('.'.repeat(65536)), { name: 'AddressError' }); assert.equal(splits, 0); }
    finally { String.prototype.split = originalSplit; }
  } finally { constants.RE_ZONE_STRING.exec = original; }
} else {
  const { Agent, fetch } = await import(pathToFileURL(context.undici).href);
  const agents = [], servers = [];
  let tls;
  const agent = options => { const value = new Agent(options); agents.push(value); return value; };
  const get = async (url, dispatcher) => (await fetch(url, { dispatcher, signal: AbortSignal.timeout(1500) })).text();
  try {
    if (mode === 'tls') {
      tls = await gatewayTlsFixture(); let calls = 0, refused = 0, allowed = 0, connected = 0;
      const server = httpsServer({ cert: tls.cert, key: tls.key }, (_req, res) => { calls++; res.end('ordinary'); });
      servers.push(server); await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
      const origin = `https://127.0.0.1:${server.address().port}`;
      assert.equal(await get(origin, agent({ tls: { ca: tls.cert } })), 'ordinary');
      const before = calls;
      await assert.rejects(get(origin, agent({ tls: { ca: tls.cert, checkServerIdentity() {
        refused++; return new Error('synthetic_tls_identity_refusal');
      } } })), error => error.cause?.message === 'synthetic_tls_identity_refusal');
      assert.equal(refused, 1); assert.equal(calls, before);
      assert.equal(await get(origin, agent({ tls: { ca: tls.cert, checkServerIdentity() { allowed++; } } })), 'ordinary');
      assert.equal(allowed, 1); const beforeConnect = calls;
      await assert.rejects(get(origin, agent({ connect: { ca: tls.cert, checkServerIdentity() {
        connected++; return new Error('synthetic_connect_identity_refusal');
      } } })), error => error.cause?.message === 'synthetic_connect_identity_refusal');
      assert.equal(connected, 1); assert.equal(calls, beforeConnect);
    } else if (mode === 'encoding') {
      const source = await loopback((req, res) => {
        if (req.url === '/ordinary') { res.end('ordinary'); return; }
        res.writeHead(200, { 'Content-Encoding': 'gzip, gzip, gzip, gzip, gzip, gzip', 'Content-Length': '128' });
        res.flushHeaders(); res.socket.end();
      });
      try {
        const dispatcher = agent();
        assert.equal(await get(source.origin + '/ordinary', dispatcher), 'ordinary');
        await assert.rejects(get(source.origin + '/excessive', dispatcher)); await delay(100);
        assert.equal(await get(source.origin + '/ordinary', dispatcher), 'ordinary');
      } finally { await source.close(); }
    } else throw new Error('unknown_bundle_probe');
  } finally {
    await Promise.all(agents.map(value => value.destroy()));
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
    await tls?.close();
  }
}
process.stdout.write(JSON.stringify({ mode, passed: true }) + '\n');
