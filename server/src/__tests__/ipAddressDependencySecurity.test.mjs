/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Exercise the locked transitive dependency used by express-rate-limit, not a mock.
import { Address4, Address6 } from 'ip-address';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import request from 'supertest';
import { jest } from '@jest/globals';

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
