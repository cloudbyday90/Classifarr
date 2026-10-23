/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Exercise the locked transitive dependency used by express-rate-limit, not a mock.
import { Address4, Address6 } from 'ip-address';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import request from 'supertest';
import { jest } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('the server override, sole locked copy and installed parser are the reviewed security patch', () => {
  const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const manifest = read('../../package.json'), lock = read('../../package-lock.json');
  expect(manifest.overrides['ip-address']).toBe('10.7.4');
  const copies = Object.entries(lock.packages).filter(([path]) => path.endsWith('node_modules/ip-address'));
  expect(copies).toHaveLength(1);
  expect(copies[0][1]).toMatchObject({ version: '10.7.4',
    integrity: 'sha512-DWBMKyeM25D70nrIiTkgQth59/G+naKOTep6huF9j+GmeK3DMD60Zvxg5d5qQnz+38AHgou6ean2LECX+lrKDg==' });
  expect(read('../../node_modules/ip-address/package.json').version).toBe('10.7.4');
});

test('IPv6 zone parsing and constructor aliases never invoke the quadratic legacy matcher', () => {
  const source = `
    import assert from 'node:assert/strict';
    import { isIPv6 } from 'node:net';
    import { Address6 } from 'ip-address';
    import { ipKeyGenerator } from 'express-rate-limit';
    import { RE_ZONE_STRING } from 'ip-address/dist/v6/constants.js';
    let legacyCalls = 0;
    const original = RE_ZONE_STRING.exec;
    // Refuse the dangerous operation rather than actually exhaust CPU on an old copy.
    RE_ZONE_STRING.exec = function () { legacyCalls++; throw new Error('legacy_zone_matcher_reached'); };
    try {
      for (const code of [10, 13, 0x2028, 0x2029]) {
        const input = '%'.repeat(2048) + String.fromCodePoint(code) + 'x';
        const routes = [() => new Address6(input),
          () => Address6.fromAddressAndMask(input, 'ffff:ffff:ffff:ffff::'),
          () => Address6.fromAddressAndMask('fe80::1', input),
          () => Address6.fromAddressAndWildcardMask(input, '::ffff:ffff:ffff:ffff'),
          () => Address6.fromAddressAndWildcardMask('fe80::1', input),
          () => Address6.fromAddress4Nat64('192.0.2.1', input),
          () => new Address6('64:ff9b::c000:201').toAddress4Nat64(input)];
        for (const route of routes) assert.throws(route, { name: 'AddressError' });
        assert.equal(Address6.isValid(input), false);
        // This additional limiter guard explains why direct parser exposure is
        // not automatically a remotely reachable application vulnerability.
        assert.equal(isIPv6(input), false);
        assert.equal(ipKeyGenerator(input), input);
      }
      const longZone = 'fe80::1%' + 'a'.repeat(8192);
      assert.equal(new Address6(longZone).correctForm(), 'fe80::1');
      assert.equal(ipKeyGenerator(longZone), 'fe80::/56');
      assert.equal(legacyCalls, 0);
    } finally { RE_ZONE_STRING.exec = original; }
    console.log('zone_parser_boundaries_passed');`;
  const output = execFileSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '--eval', source], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 5000, maxBuffer: 8192,
    windowsHide: true, stdio: 'pipe',
  });
  expect(output.trim()).toBe('zone_parser_boundaries_passed');
});

test.each(['fe80::1%eth0/64', 'fe80::1/64%eth0'])(
  'zoned IPv6 preserves both supported CIDR orders: %s', input => {
    const address = new Address6(input);
    expect(address.correctForm()).toBe('fe80::1');
    expect(address.zone).toBe('%eth0');
    expect(address.subnetMask).toBe(64);
  },
);

test.each([
  ['42.2.0.192.IN-ADDR.ARPA.', '192.0.2.42'],
  ['42.2.0.192.in-addr.arpa', '192.0.2.42'],
  ['42.2.0.192.In-AdDr.ArPa', '192.0.2.42'],
  ['255/32.255.255.255.in-addr.arpa.', '255.255.255.255'],
  ['0/25.2.0.192.in-addr.arpa.', '192.0.2.0'],
])('reverse IPv4 parsing preserves supported forms: %s', (input, expected) => {
  expect(Address4.fromArpa(input).correctForm()).toBe(expected);
});

test('oversized reverse IPv4 input is rejected before splitting or expanded diagnostics', () => {
  const split = jest.spyOn(String.prototype, 'split');
  try {
    let failure;
    try { Address4.fromArpa('.'.repeat(1024 * 1024)); } catch (error) { failure = error; }
    expect(split).not.toHaveBeenCalled();
    expect(failure?.name).toBe('AddressError');
    expect(failure?.message).toMatch(/32/);
    expect(failure?.parseMessage).toBeUndefined();
  } finally { split.mockRestore(); }
});

test.each([
  '64:ff9b:1::', '64:ff9b:1:ffff:ffff:ffff:ffff:ffff',
  '0064:ff9b:0001:0000:0000:0000:7f00:0001',
  '64:ff9b:1:7f00:0:100::', '64:ff9b:1:a9fe:a9:fe00::', '64:ff9b:1::7f00:1',
])('classifies NAT64 local-use as private: %s', ip => {
  expect(new Address6(ip).isPrivate()).toBe(true);
});

test.each([
  'fe80::', 'fe81::1', 'fe80:0:0:1::1', 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
  'FE81:0000:0000:0000:0000:0000:0000:0001', 'fe81::1%eth0',
])('classifies the full link-local range: %s', ip => {
  expect(new Address6(ip).isLinkLocal()).toBe(true);
});

test.each([
  ['64:ff9b:0:ffff:ffff:ffff:ffff:ffff', 'isPrivate', false],
  ['64:ff9b:2::', 'isPrivate', false],
  ['fe7f:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'isLinkLocal', false],
  ['fec0::1', 'isLinkLocal', false],
  ['2606:4700:4700::1111', 'isPrivate', false],
  ['64:ff9b::808:808', 'isPrivate', false],
  ['fc00::1', 'isPrivate', true],
  ['::ffff:169.254.169.254', 'isLinkLocal', true],
  ['64:ff9b::a9fe:a9fe', 'isLinkLocal', true],
])('preserves adjacent-range and legitimate control %s', (ip, method, expected) => {
  expect(new Address6(ip)[method]()).toBe(expected);
});

test('invalid IPv6 remains rejected by the dependency', () => {
  expect(() => new Address6('not-an-ip')).toThrow();
});

test('oversized invalid addresses are rejected before building an expanded diagnostic', () => {
  const input = '!'.repeat(65536);
  expect(Address6.isValid(input)).toBe(false);
  try { new Address6(input); throw new Error('unexpected acceptance'); }
  catch (error) { expect(error.name).toBe('AddressError'); expect(error.parseMessage).toBeUndefined(); }
});

test.each(['isInSubnet', 'isHostInSubnet'])('cross-family %s comparisons cannot grant containment', method => {
  expect(new Address6('a00::1')[method](new Address4('10.0.0.0/8'))).toBe(false);
  expect(new Address4('32.1.13.184')[method](new Address6('2001:db8::/32'))).toBe(false);
  expect(new Address6('2001:db8::1')[method](new Address6('2001:db8::/32'))).toBe(true);
  expect(new Address6('::ffff:10.0.0.1').to4()[method](new Address4('10.0.0.0/8'))).toBe(true);
});

test.each([
  ['mapped IPv4', '203.0.113.7', ['::ffff:203.0.113.7', '::ffff:cb00:7107', '::203.0.113.7'], '203.0.113.8'],
  ['IPv6 subnet', '2001:db8:1234:ab00::1', ['2001:db8:1234:abff::2', '2001:0db8:1234:ab00:0:0:0:1'], '2001:db8:1234:ac00::1'],
  ['NAT64 local-use subnet', '64:ff9b:1::7f00:1', ['0064:ff9b:0001:0000:0000:0000:7f00:0001'], '64:ff9b:1:100::1'],
])('real HTTP limiter preserves %s quota and separate clients', async (_label, first, equivalents, separate) => {
  const app = express();
  // Only this test app trusts one local proxy hop so Supertest can supply peer IP fixtures.
  app.set('trust proxy', 1);
  const limiter = rateLimit({ windowMs: 60_000, limit: 1, standardHeaders: 'draft-7', legacyHeaders: false });
  app.use(limiter);
  app.get('/', (_req, res) => res.json({ ok: true }));
  await request(app).get('/').set('X-Forwarded-For', first).expect(200);
  for (const ip of equivalents) {
    const denied = await request(app).get('/').set('X-Forwarded-For', ip).expect(429);
    expect(Number(denied.headers['retry-after'])).toBeGreaterThan(0);
    expect(denied.headers.ratelimit).toContain('remaining=0');
  }
  await request(app).get('/').set('X-Forwarded-For', separate).expect(200);
});
