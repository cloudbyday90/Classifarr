/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { assessHypervConfiguration, requireGatewayVmProfile } from '../lib/gatewayVmPreparation.mjs';
import { captureHypervPreparation, runVmProbe, VM_PROBE_LIMIT, VM_PROBE_TIMEOUT } from '../lib/gatewayVmProbe.mjs';
import { captureGuestPreparation } from '../lib/gatewayVmGuest.mjs';
import { runVmPreparationCli } from '../check-gateway-vm-preparation.mjs';

const vmId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const switchId = '11111111-2222-3333-4444-555555555555';
const revision = 'a'.repeat(40), secret = 'PRIVATE-OUTPUT-DO-NOT-PRINT';
const target = { vmId, switchId };
function observation() {
  return { vmId, generation: 2, cpus: 4, memoryBytes: 8589934592, dynamicMemory: false,
    disks: [{ size: 68719476736, type: 'Fixed', format: 'VHDX', parent: false }],
    adapters: [{ switchId }], switchId, switchType: 'Internal', checkpoints: 0,
    automaticStartAction: 'Nothing', automaticStopAction: 'ShutDown', hostShutdownEnabled: true };
}
const capture = command => captureHypervPreparation({ ...target, platform: 'win32', systemRoot: 'C:\\Windows', command });
function guestOptions(overrides = {}) {
  return { root: '/checkout', revision, platform: 'linux', arch: 'x64', nodeVersion: '24.22.1', uid: 1000, gid: 1000,
    canonical: path => path, controllers: () => 'cpu memory pids io\n', space: () => 20000000000,
    shutdown: () => ({ check: 'guest_shutdown_channel_bound', status: 'matched' }),
    command: (file, args) => file === 'docker' ? '{"os":"linux","arch":"x86_64","cpus":4,"cgroup":"2"}'
      : args.includes('rev-parse') ? `/checkout\n${revision}\n` : '', ...overrides };
}

test('committed profile is exact, immutable and never an authorization receipt', () => {
  const profile = requireGatewayVmProfile();
  assert.equal(profile.memoryBytes, 8 * 1024 ** 3); assert.equal(profile.diskBytes, 64 * 1024 ** 3);
  assert.ok(Object.isFrozen(profile));
  for (const mutation of [p => { p.cpus = 8; }, p => { delete p.version; }, p => { p.passed = true; },
    p => { p.dynamicMemory = true; }, p => { p.measurementInternet = true; }, p => { p.diskType = 'Dynamic'; },
    p => { p.version = 1; }, p => { p.automaticStartAction = 'Start'; }, p => { p.automaticStopAction = 'Save'; },
    p => { p.hostShutdownEnabled = false; }]) {
    const copy = { ...profile }; mutation(copy);
    assert.throws(() => requireGatewayVmProfile(copy), { message: 'gateway_vm_profile_invalid' });
  }
  const result = runVmPreparationCli(['--profile']);
  assert.equal(result.version, 2); assert.equal(result.status, 'matched'); assert.equal(result.studyReady, false);
  assert.equal(result.liveOperationsEnabled, false); assert.equal(result.handoffAuthenticated, false); assert.equal(result.remaining.length, 7);
});

test('matching Hyper-V configuration still needs network/identity and interference qualification', () => {
  const result = assessHypervConfiguration(observation(), target);
  assert.equal(result.status, 'matched'); assert.equal(result.studyReady, false);
  assert.equal(result.checks.length, 10); assert.ok(!JSON.stringify(result).includes(vmId));
  assert.equal(assessHypervConfiguration({ ...observation(), vmId: vmId.toUpperCase() }, target).status, 'matched');
});

test('wrong identities, resource allocations, extra devices, external/private switches and checkpoints fail closed', () => {
  for (const mutate of [v => { v.vmId = switchId; }, v => { v.generation = 1; }, v => { v.cpus = 8; },
    v => { v.memoryBytes++; }, v => { v.dynamicMemory = true; }, v => { v.disks = []; },
    v => { v.disks.push(v.disks[0]); }, v => { v.disks[0].type = 'Dynamic'; },
    v => { v.disks[0].format = 'VHD'; }, v => { v.disks[0].size++; }, v => { v.disks[0].parent = true; },
    v => { v.switchType = 'External'; }, v => { v.switchType = 'Private'; }, v => { v.switchId = vmId; },
    v => { v.adapters = []; }, v => { v.adapters.push(v.adapters[0]); },
    v => { v.adapters[0].switchId = vmId; }, v => { v.checkpoints = 1; },
    v => { v.automaticStartAction = 'Start'; }, v => { v.automaticStartAction = 'StartIfRunning'; },
    v => { v.automaticStopAction = 'Save'; }, v => { v.automaticStopAction = 'TurnOff'; },
    v => { v.hostShutdownEnabled = false; }]) {
    const value = observation(); mutate(value);
    const result = assessHypervConfiguration(value, target);
    assert.equal(result.status, 'mismatch'); assert.equal(result.studyReady, false);
  }
});

test('incomplete/untyped/extra Hyper-V evidence is unavailable, not a match or leaked diagnostic', () => {
  for (const mutate of [v => { delete v.dynamicMemory; }, v => { v.cpus = '4'; },
    v => { v.disks[0].size = null; }, v => { v.vmId = 'bad'; }, v => { v.adapters[0].switchId = ''; },
    v => { v.checkpoints = -1; }, v => { v.raw = secret; }, v => { v.disks = Array(9).fill(v.disks[0]); },
    v => { v.adapters = Array(9).fill(v.adapters[0]); }, v => { v.disks[0].path = secret; },
    v => { delete v.automaticStartAction; }, v => { v.automaticStartAction = null; },
    v => { delete v.automaticStopAction; }, v => { v.automaticStopAction = 1; },
    v => { delete v.hostShutdownEnabled; }, v => { v.hostShutdownEnabled = 'true'; }]) {
    const value = observation(); mutate(value);
    const result = assessHypervConfiguration(value, target);
    assert.equal(result.status, 'unavailable'); assert.ok(!JSON.stringify(result).includes(secret));
  }
  for (const value of [null, [], true, 'private']) assert.equal(assessHypervConfiguration(value, target).status, 'unavailable');
});

test('PowerShell query has only validated targets and fixed read-only cmdlets, no elevation or wildcard targets', () => {
  let calls = 0;
  const result = capture((file, args) => {
    calls++; assert.match(file, /WindowsPowerShell[\\/]v1\.0[\\/]powershell\.exe$/);
    assert.deepEqual(args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand']);
    const query = Buffer.from(args[4], 'base64').toString('utf16le');
    assert.match(query, /Set-StrictMode -Version Latest/);
    assert.match(query, /Get-VM -Id/); assert.ok(query.includes(vmId) && query.includes(switchId));
    assert.match(query, /Get-VHD -Path/); assert.match(query, /Get-VMSnapshot -VM/);
    assert.match(query, /Get-VMIntegrationService -VM \$vm -Name 'Shutdown'/);
    assert.match(query, /\$shutdown.Count -ne 1/); assert.match(query, /Enabled -isnot \[bool\]/);
    assert.match(query, /automaticStartAction=\[string\]\$vm.AutomaticStartAction/);
    assert.match(query, /automaticStopAction=\[string\]\$vm.AutomaticStopAction/);
    assert.doesNotMatch(query, /Enable-VM|Disable-VM/);
    assert.doesNotMatch(query, /\b(?:New|Set|Remove|Start|Stop|Grant|Invoke|Mount|Import)-VM|Start-Process|RunAs|ComputerName|Credential/);
    return JSON.stringify(observation());
  });
  assert.equal(calls, 1); assert.equal(result.status, 'matched');
  assert.equal(capture(() => '\uFEFF' + JSON.stringify(observation())).status, 'matched');
});

test('invalid/injection GUIDs never reach a command; unsupported host does not probe', () => {
  const command = () => { throw new Error('must not call'); };
  for (const invalid of ['*', `${vmId}';exit;#`, `${vmId}\n`, `${vmId}\r\n`, '', null, '00000000-0000-0000-0000-000000000000']) {
    assert.throws(() => captureHypervPreparation({ vmId: invalid, switchId, command }), /gateway_vm_arguments_invalid/);
    assert.throws(() => assessHypervConfiguration(observation(), { vmId, switchId: invalid }), /gateway_vm_arguments_invalid/);
  }
  assert.equal(captureHypervPreparation({ ...target, platform: 'linux', command }).status, 'unavailable');
});

test('denied, malformed, oversized and failed commands have fixed unavailable output and no raw exceptions', () => {
  for (const command of [() => null, () => secret, () => '{', () => ' '.repeat(VM_PROBE_LIMIT),
    () => { throw new Error(secret); }]) {
    const result = capture(command);
    assert.equal(result.status, 'unavailable'); assert.equal(result.studyReady, false);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});

test('command capture is bounded, noninteractive, shell-free and ignores Docker environment overrides', () => {
  const env = { PATH: '/bin', DOCKER_HOST: 'tcp://private', DOCKER_CONTEXT: 'remote', DOCKER_CONFIG: '/private', docker_host: 'tcp://other' };
  let calls = 0;
  assert.equal(runVmProbe('docker', ['info'], { env, cwd: '/checkout', run: (file, args, options) => {
    calls++; assert.equal(file, 'docker'); assert.deepEqual(args, ['info']);
    assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    assert.equal(options.timeout, VM_PROBE_TIMEOUT); assert.equal(options.maxBuffer, VM_PROBE_LIMIT);
    assert.equal(options.cwd, '/checkout'); assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.equal(options.env.GIT_OPTIONAL_LOCKS, '0'); assert.equal(options.env.DOCKER_HOST, undefined);
    assert.equal(options.env.DOCKER_CONTEXT, undefined); assert.equal(options.env.DOCKER_CONFIG, undefined);
    assert.equal(options.env.docker_host, undefined);
    return { status: 0, stdout: 'ok', stderr: '' };
  } }), 'ok');
  assert.equal(calls, 1); assert.equal(env.DOCKER_CONTEXT, 'remote');
  for (const result of [{ status: 1, stdout: secret }, { status: 0, error: { code: 'ETIMEDOUT' } },
    { status: 0, error: { code: 'ENOBUFS' } }, { status: 0, stdout: 'é'.repeat(VM_PROBE_LIMIT / 2) },
    { status: 0, stdout: '', stderr: 'x'.repeat(VM_PROBE_LIMIT) }, { status: null }]) {
    assert.equal(runVmProbe('docker', [], { run: () => result }), null);
  }
  assert.equal(runVmProbe('docker', [], { run: () => { throw new Error(secret); } }), null);
});

test('guest capture selects local socket and exact clean checkout but cannot mark study ready', () => {
  const options = guestOptions(), calls = [], command = options.command;
  options.command = (file, args, settings) => { calls.push([file, args]); assert.equal(settings.cwd, '/checkout'); return command(file, args); };
  const result = captureGuestPreparation(options);
  assert.equal(result.status, 'matched'); assert.equal(result.studyReady, false);
  assert.equal(result.filesystemFreeBytes, 20000000000); assert.equal(calls.length, 3);
  for (const [file, args] of calls.filter(([file]) => file === 'git')) {
    assert.equal(file, 'git'); assert.ok(args.includes('--no-optional-locks'));
    assert.ok(args.includes('core.fsmonitor=false') && args.includes('core.untrackedCache=false'));
  }
  assert.deepEqual(calls[2][1].slice(0, 4), ['--host', 'unix:///var/run/docker.sock', 'info', '--format']);
  assert.ok(!JSON.stringify(result).includes('/checkout'));
});

test('guest Node security minimum follows the repository baseline using synthetic observations only', () => {
  const baseline = readFileSync(new URL('../../.nvmrc', import.meta.url), 'utf8').trim();
  const [major, minor, patch] = baseline.split('.').map(Number);
  assert.ok(patch > 0, 'Update the predecessor fixture when selecting a zero-patch baseline');
  for (const nodeVersion of [baseline, `${major}.${minor}.${patch + 1}`, '24.23.0', '24.100.0']) {
    assert.equal(captureGuestPreparation(guestOptions({ nodeVersion })).status, 'matched', nodeVersion);
  }
  for (const nodeVersion of [`${major}.${minor}.${patch - 1}`, '24.21.99', '24.22.0',
    '24.22.1-rc.1', '24.22.1+build', '24.022.1', '24.22.01', '24.22.1\n',
    '24.9007199254740992.0', '24.23.9007199254740992', '25.0.0', null, 24]) {
    const result = captureGuestPreparation(guestOptions({ nodeVersion }));
    assert.equal(result.checks.find(row => row.check === 'node_24').status, 'mismatch', String(nodeVersion));
    assert.equal(result.studyReady, false);
  }
});

test('guest version/identity/architecture checks and missing local observations do not silently qualify', () => {
  for (const overrides of [{ uid: 0 }, { gid: 0 }, { arch: 'arm64' }, { nodeVersion: '24.20.0' },
    { nodeVersion: '25.0.0' }, { nodeVersion: '24.21.0-rc.1' }, { canonical: () => { throw new Error(secret); } },
    { controllers: () => 'cpu io' }, { space: () => null }, { space: () => -1 },
    { space: () => Infinity }, { controllers: () => { throw new Error(secret); } },
    { controllers: () => 'x'.repeat(4097) }, { command: () => null },
    { shutdown: () => ({ check: 'guest_shutdown_channel_bound', status: 'unavailable', private: secret }) },
    { shutdown: () => ({ check: 'guest_shutdown_channel_bound', status: 'mismatch' }) },
    { shutdown: () => ({ check: secret, status: 'matched' }) }, { shutdown: () => ({ status: 'healthy' }) },
    { shutdown: () => { throw new Error(secret); } }]) {
    const result = captureGuestPreparation(guestOptions(overrides));
    assert.notEqual(result.status, 'matched'); assert.equal(result.studyReady, false);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
  const nonLinux = captureGuestPreparation(guestOptions({ platform: 'win32', command: () => { throw new Error('must not call'); },
    shutdown: () => assert.fail('non-Linux must not probe') }));
  assert.equal(nonLinux.status, 'unavailable');
  assert.throws(() => captureGuestPreparation(guestOptions({ revision: 'main' })), /gateway_vm_arguments_invalid/);
});

test('actual child capture rejects oversized output and terminates a stalled query without exposing output', () => {
  assert.equal(runVmProbe(process.execPath, ['-e', 'process.stdout.write("x".repeat(131072))']), null);
  assert.equal(runVmProbe(process.execPath, ['-e', 'setInterval(() => {}, 1000)']), null);
});

test('dirty/wrong checkout and unsupported/malformed Docker engine evidence stay unqualified and private', () => {
  for (const [kind, value] of [['rev-parse', `/other\n${revision}`], ['rev-parse', `/checkout\n${'b'.repeat(40)}`],
    ['status', secret], ['rev-parse', null], ['docker', '{"os":"windows","arch":"amd64","cpus":4,"cgroup":"2"}'],
    ['docker', '{"os":"linux","arch":"arm64","cpus":8,"cgroup":"1"}'], ['docker', '{"passed":true}'],
    ['docker', secret], ['docker', ' '.repeat(VM_PROBE_LIMIT)]]) {
    const options = guestOptions(), command = options.command;
    options.command = (file, args) => (file === 'docker' ? 'docker' : args.includes('rev-parse') ? 'rev-parse' : 'status') === kind ? value : command(file, args);
    const result = captureGuestPreparation(options);
    assert.notEqual(result.status, 'matched'); assert.equal(result.studyReady, false);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
  const missingSpace = captureGuestPreparation(guestOptions({ space: () => { throw new Error(secret); } }));
  assert.equal(missingSpace.filesystemFreeBytes, null);
});

test('CLI accepts only explicit ordered modes and rejects write/receipt/retry options before any probe', () => {
  let calls = 0;
  const dependencies = { host: args => { calls++; assert.deepEqual(args, target); return {}; },
    guest: args => { calls++; assert.equal(args.revision, revision); assert.ok(args.root); return {}; },
    handoff: args => { calls++; assert.deepEqual(args, { file: '/private/record.json', ...target }); return {}; } };
  for (const args of [[], ['--apply'], ['--profile', '--run'], ['--host'], ['--host', '--vm-id', '*', '--switch-id', switchId],
    ['--guest', '--revision', 'main'], ['--guest', '--revision', `${revision}\n`],
    ['--guest', '--revision', revision, '--retry'], ['--receipt', 'proof.json'], ['--handoff'],
    ['--handoff', '--file', '/private/record.json', '--switch-id', switchId, '--vm-id', vmId],
    ['--handoff', '--file', '/private/record.json', '--vm-id', '*', '--switch-id', switchId]]) {
    assert.throws(() => runVmPreparationCli(args, dependencies), /gateway_vm_arguments_invalid/);
  }
  assert.equal(calls, 0);
  runVmPreparationCli(['--host', '--vm-id', vmId, '--switch-id', switchId], dependencies);
  runVmPreparationCli(['--guest', '--revision', revision], dependencies);
  runVmPreparationCli(['--handoff', '--file', '/private/record.json', '--vm-id', vmId, '--switch-id', switchId], dependencies);
  assert.equal(calls, 3);
});

test('real CLI prints only bounded preparation evidence with meaningful exit codes', () => {
  const cli = fileURLToPath(new URL('../check-gateway-vm-preparation.mjs', import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: VM_PROBE_LIMIT, windowsHide: true });
  const profile = run(['--profile']); assert.equal(profile.status, 0);
  assert.equal(JSON.parse(profile.stdout).studyReady, false); assert.equal(profile.stderr, '');
  const invalid = run(['--provision', secret]); assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).studyReady, false); assert.ok(!invalid.stdout.includes(secret)); assert.equal(invalid.stderr, '');
  if (process.platform !== 'linux') {
    const guest = run(['--guest', '--revision', revision]); assert.equal(guest.status, 2);
    assert.equal(JSON.parse(guest.stdout).status, 'unavailable'); assert.equal(guest.stderr, '');
  }
});
