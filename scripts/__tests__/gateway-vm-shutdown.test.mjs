/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { captureGuestShutdown, VM_SHUTDOWN_DEVICE_LIMIT } from '../lib/gatewayVmShutdown.mjs';

const one = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', two = '11111111-2222-3333-4444-555555555555';
const shutdown = '{0e0b6031-5213-4934-818b-38d90ced39db}\n', other = `{${two}}\n`;
const driver = '/sys/bus/vmbus/drivers/hv_utils';
function fixture({ names = [one, two], type = () => shutdown, binding = driver } = {}) {
  let directoryCloses = 0, fileCloses = 0, scans = 0, files = 0;
  const io = {
    opendirSync(path) {
      assert.equal(path, '/sys/bus/vmbus/devices'); const scan = ++scans;
      const list = typeof names === 'function' ? names(scan) : names; let index = 0;
      return { readSync: () => index < list.length ? { name: list[index++] } : null, closeSync: () => { directoryCloses++; } };
    },
    openSync(path, flags) {
      assert.match(path, /^\/sys\/bus\/vmbus\/devices\/[a-f0-9-]{36}\/class_id$/);
      assert.equal(flags, constants.O_RDONLY | constants.O_NONBLOCK);
      return { bytes: Buffer.from(path.includes(one) ? type(++files) : other) };
    },
    readSync(fd, buffer, offset, length, position) {
      assert.equal(buffer.length, 40); assert.ok(length <= 40);
      return fd.bytes.copy(buffer, offset, position, position + length);
    },
    closeSync: () => { fileCloses++; },
    realpathSync(path) { assert.equal(path, `/sys/bus/vmbus/devices/${one}/driver`); return binding; },
  };
  return { io, counts: () => ({ directoryCloses, fileCloses, scans, files }) };
}
const capture = io => captureGuestShutdown({ platform: 'linux', io });
const expected = status => ({ check: 'guest_shutdown_channel_bound', status });

test('fixed guest-local shutdown class and binding are observed twice with bounded descriptor reads', () => {
  const f = fixture(); assert.deepEqual(capture(f.io), expected('matched'));
  assert.deepEqual(f.counts(), { directoryCloses: 2, fileCloses: 4, scans: 2, files: 2 });
});
test('absence or a different stable driver is a mismatch, not functional shutdown proof', () => {
  for (const options of [{ names: [] }, { type: () => other }, { binding: '/sys/bus/vmbus/drivers/other' }]) {
    assert.deepEqual(capture(fixture(options).io), expected('mismatch'));
  }
});
test('malformed, oversized, changing or duplicate device/class observations stay unavailable', () => {
  for (const options of [{ names: ['../escape'] }, { names: [one, one] }, { names: [one + '\n'] },
    { names: Array.from({ length: VM_SHUTDOWN_DEVICE_LIMIT + 1 }, (_, i) => `aaaaaaaa-bbbb-cccc-dddd-${i.toString(16).padStart(12, '0')}`) },
    { names: scan => scan === 1 ? [one] : [one, two] }, { type: scan => scan === 1 ? shutdown : other },
    ...['', '{}\n', shutdown + 'x', shutdown.replace('\n', ''), '{' + 'x'.repeat(36) + '}\n', 'x'.repeat(1000)].map(value => ({ type: () => value }))]) {
    assert.deepEqual(capture(fixture(options).io), expected('unavailable'));
  }
  const f = fixture(); f.io.openSync = () => ({ bytes: Buffer.from(shutdown) });
  f.io.realpathSync = () => driver; // Two shutdown devices cannot qualify.
  assert.deepEqual(capture(f.io), expected('unavailable'));
});
test('a complete bounded inventory is required; every I/O failure is sanitized and closes opened handles', () => {
  for (const method of ['opendirSync', 'openSync', 'readSync', 'closeSync', 'realpathSync']) {
    const f = fixture(); f.io[method] = () => { throw new Error('PRIVATE-SYSFS-ERROR'); };
    assert.deepEqual(capture(f.io), expected('unavailable'));
  }
  for (const method of ['readSync', 'closeSync']) {
    let closed = false;
    const f = fixture(); f.io.opendirSync = () => ({ readSync: method === 'readSync' ? () => { throw new Error(); } : () => null,
      closeSync: () => { closed = true; if (method === 'closeSync') throw new Error(); } });
    assert.deepEqual(capture(f.io), expected('unavailable')); assert.ok(closed);
  }
  const f = fixture(); f.io.realpathSync = () => { throw new Error(); };
  capture(f.io); assert.equal(f.counts().fileCloses, 2);
});
test('non-Linux never probes a sysfs interface', () => {
  assert.deepEqual(captureGuestShutdown({ platform: 'win32', io: new Proxy({}, { get() { assert.fail('must not probe'); } }) }), expected('unavailable'));
});
