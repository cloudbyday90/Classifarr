/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assessVmHandoff, VM_HANDOFF_BYTES } from '../lib/gatewayVmHandoff.mjs';
import { assessVmHandoffFile } from '../lib/gatewayVmHandoffFile.mjs';

const vmId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', switchId = '11111111-2222-3333-4444-555555555555';
const target = { vmId, switchId }, privateText = 'PRIVATE-HANDOFF-DO-NOT-PRINT';
// Fictional public material, never a private key or a trusted host identity.
const wire = Buffer.concat([Buffer.from([0, 0, 0, 11]), Buffer.from('ssh-ed25519'), Buffer.from([0, 0, 0, 32]), Buffer.alloc(32, 7)]);
const hostKey = `ssh-ed25519 ${wire.toString('base64')}`;
const hostKeyFingerprint = `SHA256:${createHash('sha256').update(wire).digest('base64').replace(/=+$/, '')}`;
const record = () => ({ version: 1, handoffId: '019a0000-1234-7abc-8def-0123456789ab', ...target,
  ssh: { address: '192.168.70.2', port: 22, user: 'study', hostKey, hostKeyFingerprint } });
const assess = value => assessVmHandoff(JSON.stringify(value), target);
const changedInode = value => value === 0 ? 1 : 0;
function safe(result, status) {
  assert.equal(result.status, status); assert.equal(result.studyReady, false);
  assert.equal(result.handoffAuthenticated, false); assert.equal(result.liveOperationsEnabled, false);
  for (const value of [vmId, switchId, privateText, hostKey, hostKeyFingerprint, '192.168.70.2']) assert.ok(!JSON.stringify(result).includes(value));
}
function fileFixture(t, contents = JSON.stringify(record())) {
  const root = fs.mkdtempSync(join(tmpdir(), 'classifarr-vm-handoff-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); fs.rmSync(root, { recursive: true }); });
  const file = join(root, 'handoff.json'); fs.writeFileSync(file, contents, { mode: 0o600 });
  return { root, file, args: { file, ...target } };
}

test('canonical compact/pretty LF/CRLF records check intent only, not authenticity or readiness', () => {
  for (const indent of [undefined, 2]) for (const newline of ['', '\n']) {
    const text = JSON.stringify(record(), null, indent) + newline;
    safe(assessVmHandoff(text, target), 'matched');
    safe(assessVmHandoff(text.replace(/\n/g, '\r\n'), target), 'matched');
  }
  const value = record(); value.vmId = value.vmId.toUpperCase(); safe(assess(value), 'matched');
  for (const address of ['10.2.3.4', '172.16.0.2', '172.31.255.254', 'fd12::2', 'FC00::123']) {
    const v = record(); v.ssh.address = address; safe(assess(v), 'matched');
  }
  for (const port of [1, 65535]) { const v = record(); v.ssh.port = port; safe(assess(v), 'matched'); }
  for (const user of ['_study', 'study-user_1', 's'.repeat(32)]) { const v = record(); v.ssh.user = user; safe(assess(v), 'matched'); }
});
test('each required field and unknown approval/command/secret fields fail closed', () => {
  for (const area of ['', 'ssh']) {
    for (const key of Object.keys(area ? record().ssh : record())) {
      const v = record(); delete (area ? v.ssh : v)[key]; safe(assess(v), 'unavailable');
    }
    for (const key of ['approved', 'ready', 'command', 'password', 'privateKey']) {
      const v = record(); (area ? v.ssh : v)[key] = privateText; safe(assess(v), 'unavailable');
    }
  }
  for (const value of [null, [], true, 1, 'private', { ...record(), ssh: [] }, { ...record(), version: 2 }]) safe(assess(value), 'unavailable');
});
test('duplicate keys, noncanonical JSON, oversized input and invalid target arguments cannot qualify', () => {
  const text = JSON.stringify(record());
  for (const value of [null, 1, '', '{', `${text}\n\n`, ` ${text}`, '\uFEFF' + text, text + 'x',
    text.replace('"version":1', '"version":2,"version":1'),
    text.replace('"port":22', '"port":1,"port":22'), 'x'.repeat(VM_HANDOFF_BYTES + 1),
    text.replace('"port":22', '"port":2.2e1'), text.replace('"version":1', '"version":1e999')]) {
    safe(assessVmHandoff(value, target), 'unavailable');
  }
  for (const invalid of ['', '*', vmId + '\n', '00000000-0000-0000-0000-000000000000']) {
    assert.throws(() => assessVmHandoff(text, { vmId: invalid, switchId }), /gateway_vm_arguments_invalid/);
    assert.throws(() => assessVmHandoffFile({ file: '/no-file', vmId, switchId: invalid }), /gateway_vm_arguments_invalid/);
  }
});
test('UUIDv7 and host target identities are checked separately from record format', () => {
  for (const id of [null, vmId, '019a0000-1234-4abc-8def-0123456789ab', '019a0000-1234-7abc-7def-0123456789ab',
    '019A0000-1234-7abc-8def-0123456789ab', record().handoffId + '\n']) {
    safe(assess({ ...record(), handoffId: id }), 'unavailable');
  }
  for (const key of ['vmId', 'switchId']) {
    safe(assess({ ...record(), [key]: key === 'vmId' ? switchId : vmId }), 'mismatch');
    safe(assess({ ...record(), [key]: '*' }), 'unavailable');
  }
});
test('only bounded literal private addresses, integer ports and non-root simple users are accepted', () => {
  const cases = {
    address: [null, 'localhost', '127.0.0.1', '8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1',
      '::1', 'fe80::2', 'fd00::2%eth0', '::ffff:192.168.1.2', '10.0.0.1\n', 'x'.repeat(46)],
    port: [null, '22', 0, 65536, 1.5],
    user: [null, '', 'root', '1study', 'study\n', 'study\r\n', 'study user', '-oProxyCommand=x', 'x'.repeat(33)],
  };
  for (const [key, values] of Object.entries(cases)) for (const value of values) {
    const v = record(); v.ssh[key] = value; safe(assess(v), 'unavailable');
  }
});
test('host key encoding and SHA256 consistency do not silently accept malformed or arbitrary key blobs', () => {
  const badWire = [Buffer.alloc(51), Buffer.from(wire), Buffer.from(wire), Buffer.from(wire)];
  badWire[1].writeUInt32BE(12, 0); badWire[2].writeUInt32BE(31, 15); badWire[3][4] = 0x80;
  for (const value of [null, '', hostKey + ' comment', hostKey.replace('ssh-ed25519', 'ssh-rsa'),
    hostKey.slice(0, -1) + '=', ...badWire.map(b => `ssh-ed25519 ${b.toString('base64')}`)]) {
    const v = record(); v.ssh.hostKey = value; safe(assess(v), 'unavailable');
  }
  for (const value of [null, '', hostKeyFingerprint + '=', hostKeyFingerprint.slice(0, -1) + 'x']) {
    const v = record(); v.ssh.hostKeyFingerprint = value; safe(assess(v), 'unavailable');
  }
  for (const mutate of [b => { b[4] |= 0x80; }, b => { b.fill(0, 19); }]) {
    const bytes = Buffer.from(wire); mutate(bytes); const v = record();
    v.ssh.hostKey = `ssh-ed25519 ${bytes.toString('base64')}`;
    v.ssh.hostKeyFingerprint = `SHA256:${createHash('sha256').update(bytes).digest('base64').replace(/=+$/, '')}`;
    safe(assess(v), 'unavailable');
  }
});
test('actual local file reader and CLI keep keys, contents, paths and errors private', t => {
  const f = fileFixture(t); const result = assessVmHandoffFile(f.args);
  safe(result, 'matched'); assert.equal(result.unixFileModeChecked, process.platform !== 'win32');
  const cli = fileURLToPath(new URL('../check-gateway-vm-preparation.mjs', import.meta.url));
  const run = file => spawnSync(process.execPath, [cli, '--handoff', '--file', file, '--vm-id', vmId, '--switch-id', switchId],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 65536, windowsHide: true });
  const ok = run(f.file); assert.equal(ok.status, 0); assert.equal(ok.stderr, ''); safe(JSON.parse(ok.stdout), 'matched');
  const missing = run(join(f.root, privateText)); assert.equal(missing.status, 2); assert.equal(missing.stderr, '');
  safe(JSON.parse(missing.stdout), 'unavailable'); assert.ok(!ok.stdout.includes(f.root)); assert.ok(!missing.stdout.includes(f.root));
  fs.writeFileSync(f.file, JSON.stringify({ ...record(), vmId: switchId })); safe(assessVmHandoffFile(f.args), 'mismatch');
});
test('relative/network/stream/special/linked/oversized/invalid UTF8 files never qualify', t => {
  const f = fileFixture(t);
  for (const file of ['', 'relative.json', '//server/file', '\\\\server\\file', f.file + '\n', f.file + '\0', 'x'.repeat(2049), f.root]) {
    safe(assessVmHandoffFile({ ...f.args, file }), 'unavailable');
  }
  safe(assessVmHandoffFile({ ...f.args, file: f.file + ':stream' }, { platform: 'win32' }), 'unavailable');
  fs.linkSync(f.file, join(f.root, 'hardlink')); safe(assessVmHandoffFile(f.args), 'unavailable');
  fs.unlinkSync(join(f.root, 'hardlink'));
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(VM_HANDOFF_BYTES + 1), Buffer.from([0xc0, 0x80])]) {
    fs.writeFileSync(f.file, bytes); safe(assessVmHandoffFile(f.args), 'unavailable');
  }
});
test('real final and prefix symlinks are rejected', { skip: process.platform === 'win32' ? 'Windows symlink privilege is not assumed; exercised in Linux' : false }, t => {
  const f = fileFixture(t), linked = join(f.root, 'linked.json'), prefix = join(f.root, 'prefix');
  fs.symlinkSync(f.file, linked); fs.symlinkSync(f.root, prefix);
  for (const file of [linked, join(prefix, 'handoff.json')]) safe(assessVmHandoffFile({ ...f.args, file }), 'unavailable');
});
test('owner and mode are mandatory on Unix; Windows ACL privacy is never claimed', t => {
  const f = fileFixture(t), stat = fs.lstatSync(f.file);
  for (const fields of [{ uid: 1001 }, { mode: 0o100644 }]) {
    const io = { ...fs, lstatSync: path => ({ ...fs.lstatSync(path), ...fields, isFile: () => true, isSymbolicLink: () => false }) };
    safe(assessVmHandoffFile(f.args, { io, platform: 'linux', uid: 1000 }), 'unavailable');
  }
  safe(assessVmHandoffFile(f.args, { platform: 'linux', uid: NaN }), 'unavailable');
  if (process.platform !== 'win32') {
    fs.chmodSync(f.file, 0o644); safe(assessVmHandoffFile(f.args), 'unavailable'); fs.chmodSync(f.file, 0o600);
    safe(assessVmHandoffFile(f.args, { platform: 'linux', uid: stat.uid + 1 }), 'unavailable');
  }
  const windows = assessVmHandoffFile(f.args, { platform: 'win32' }); safe(windows, 'matched'); assert.equal(windows.unixFileModeChecked, false);
});
test('inode-drift fault injection changes even a Number whose unit increment rounds away', () => {
  assert.equal(2 ** 54 + 1, 2 ** 54);
  for (const value of [0, 1, 42, Number.MAX_SAFE_INTEGER, 2 ** 54]) assert.notEqual(changedInode(value), value);
});

test('changed metadata, canonical path, reads and close failures cannot leave a positive result', t => {
  const f = fileFixture(t);
  for (const method of ['lstatSync', 'realpathSync', 'openSync', 'fstatSync', 'readSync']) {
    const io = { ...fs, [method]: () => { throw new Error(privateText); } };
    safe(assessVmHandoffFile(f.args, { io }), 'unavailable');
  }
  for (const method of ['fstatSync', 'lstatSync']) {
    let calls = 0;
    // Windows inode Numbers may exceed MAX_SAFE_INTEGER: adding one can round away.
    const io = { ...fs, [method]: value => { const stat = fs[method](value); if (++calls > (method === 'lstatSync' ? 1 : 0)) stat.ino = changedInode(stat.ino); return stat; } };
    safe(assessVmHandoffFile(f.args, { io }), 'unavailable');
  }
  let stats = 0;
  safe(assessVmHandoffFile(f.args, { io: { ...fs, fstatSync: fd => {
    const stat = fs.fstatSync(fd); if (++stats === 2) stat.size++; return stat;
  } } }), 'unavailable');
  let changed = false;
  safe(assessVmHandoffFile(f.args, { io: { ...fs, readSync: (fd, ...args) => {
    if (!changed) { changed = true; fs.appendFileSync(f.file, 'x'); }
    return fs.readSync(fd, ...args);
  } } }), 'unavailable');
  fs.writeFileSync(f.file, JSON.stringify(record()));
  const special = { ...fs.lstatSync(f.file), isFile: () => false, isSymbolicLink: () => false };
  safe(assessVmHandoffFile(f.args, { io: { ...fs, lstatSync: () => special } }), 'unavailable');
  let calls = 0;
  safe(assessVmHandoffFile(f.args, { io: { ...fs, realpathSync: path => ++calls === 1 ? fs.realpathSync(path) : '/changed' } }), 'unavailable');
  safe(assessVmHandoffFile(f.args, { io: { ...fs, readSync: () => 0 } }), 'unavailable');
  safe(assessVmHandoffFile(f.args, { io: { ...fs, closeSync: fd => { fs.closeSync(fd); throw new Error(privateText); } } }), 'unavailable');
});
