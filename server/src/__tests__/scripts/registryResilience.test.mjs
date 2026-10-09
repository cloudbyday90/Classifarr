/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registryCommand, registryFailure } from '../../../../scripts/lib/registryCommand.mjs';
import { credentialSummary, readCredentialSummary, probeRegistry } from '../../../../scripts/lib/registryDiagnostics.mjs';
import { authenticateDockerHub, logoutDockerHub, trustedPullContext } from '../../../../scripts/lib/dockerHubPullAuth.mjs';
import { compareRegistryPulls, CI_DATABASE_IMAGE } from '../../scripts/checkCiRegistryPull.mjs';

const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'cloudbyday90/Classifarr',
  GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', INPUT_USERNAME: 'fixture-user', INPUT_PASSWORD: 'fixture-secret' };
const success = { ok: true, stdout: '', stderr: '' };
const failed = stderr => ({ ok: false, stderr });
function fixture(results = [success]) {
  return { env, command: jest.fn(async () => results.shift() ?? success),
    summary: jest.fn(async () => ({ state: 'read', authOverride: false })),
    probe: jest.fn(async endpoint => ({ endpoint, status: endpoint === 'auth' ? 200 : 401 })),
    wait: jest.fn(async () => {}), report: jest.fn() };
}

test.each([
  ['received unexpected HTTP status: 500 Internal Server Error', 'registry_unavailable'],
  ['HTTP code 503 server error', 'registry_unavailable'],
  ['status code 502', 'registry_unavailable'],
  ['status: 504', 'registry_unavailable'],
  ['context deadline exceeded', 'transport_timeout'],
  ['Client.Timeout exceeded while awaiting headers', 'transport_timeout'],
  ['ECONNRESET', 'transport_timeout'],
  ['HTTP code 500 toomanyrequests: reached unauthenticated pull rate limit', 'rate_limit'],
  ['HTTP code 500 unauthorized: incorrect credentials', 'credentials_rejected'],
  ['HTTP code 500 x509: certificate expired', 'tls_failure'],
  ['no such host', 'unknown_failure'],
  ['unexpected EOF', 'unknown_failure'],
  ['invalid account 500', 'unknown_failure'],
])('classifies without returning private text: %s', (text, code) => {
  expect(registryFailure(failed(text))).toBe(code);
});

test('retry budget is three attempts and two bounded waits; secrets never enter reports', async () => {
  const f = fixture([failed('status code 500 fixture-secret'), failed('context deadline exceeded'), success]);
  await authenticateDockerHub(f);
  expect(f.command).toHaveBeenCalledTimes(3);
  expect(f.wait.mock.calls.map(call => call[0])).toEqual([10_000, 30_000]);
  expect(f.command.mock.calls[0][1]).not.toContain(env.INPUT_PASSWORD);
  expect(f.command.mock.calls[0][2].input).toBe(env.INPUT_PASSWORD);
  expect(f.command.mock.calls[0][2].timeoutMs).toBe(30_000);
  expect(JSON.stringify(f.report.mock.calls)).not.toMatch(/fixture-secret|fixture-user/);
});

test('exhaustion never falls back to anonymous credentials', async () => {
  const f = fixture(Array(3).fill(failed('status code 503')));
  await expect(authenticateDockerHub(f)).rejects.toThrow('registry_unavailable');
  expect(f.command).toHaveBeenCalledTimes(3);
  expect(f.wait).toHaveBeenCalledTimes(2);
});

test.each(['incorrect authentication credentials', 'too many requests', 'x509 certificate', 'unknown failure'])
  ('permanent/unknown failure is not retried: %s', async text => {
    const f = fixture([failed(text)]);
    await expect(authenticateDockerHub(f)).rejects.toThrow();
    expect(f.command).toHaveBeenCalledTimes(1);
    expect(f.wait).not.toHaveBeenCalled();
  });

test.each([
  ['GITHUB_ACTIONS', 'false'], ['GITHUB_REPOSITORY', 'fork/Classifarr'],
  ['GITHUB_REF', 'refs/tags/v1'], ['GITHUB_REF', 'refs/heads/topic'],
  ['GITHUB_EVENT_NAME', 'pull_request'], ['GITHUB_EVENT_NAME', 'pull_request_target'],
])('runtime denies %s=%s without network or credentials', async (key, value) => {
  const f = fixture(); f.env = { ...env, [key]: value };
  expect(trustedPullContext(f.env)).toBe(false);
  await expect(authenticateDockerHub(f)).rejects.toThrow('untrusted_context');
  expect(f.command).not.toHaveBeenCalled();
  expect(f.probe).not.toHaveBeenCalled();
});

test.each(['', ' ', 'fixture-secret\n', ' fixture-secret'])('invalid token stops before network: %j', async password => {
  const f = fixture(); f.env = { ...env, INPUT_PASSWORD: password };
  await expect(authenticateDockerHub(f)).rejects.toThrow(/credentials_/);
  expect(f.probe).not.toHaveBeenCalled();
  expect(f.command).not.toHaveBeenCalled();
});

test('auth override is a blocking credential-source conflict', async () => {
  const f = fixture(); f.summary.mockResolvedValue({ state: 'read', authOverride: true });
  await expect(authenticateDockerHub(f)).rejects.toThrow('conflicting_auth_override');
  expect(f.command).not.toHaveBeenCalled();
});

test('cancellation during backoff prevents another login', async () => {
  const f = fixture([failed('status code 500')]);
  f.wait.mockRejectedValue(new Error('private error'));
  await expect(authenticateDockerHub(f)).rejects.toThrow('cancelled');
  expect(f.command).toHaveBeenCalledTimes(1);
});

test('pre-cancelled action never attempts login', async () => {
  const f = fixture();
  const controller = new AbortController(); controller.abort(); f.signal = controller.signal;
  await expect(authenticateDockerHub(f)).rejects.toThrow('cancelled');
  expect(f.command).not.toHaveBeenCalled();
});

test('logout remains bounded and fails closed', async () => {
  const f = fixture([failed('private error')]);
  await expect(logoutDockerHub(f)).rejects.toThrow('logout_failed');
  expect(f.command.mock.calls[0][1]).toEqual(['logout', 'docker.io']);
  expect(f.command.mock.calls[0][2].timeoutMs).toBe(30_000);
  expect(JSON.stringify(f.report.mock.calls)).not.toContain('private error');
});

test('configuration summary discloses booleans only', () => {
  const summary = credentialSummary({ auths: { 'https://index.docker.io/v1/': { auth: 'private' } },
    credsStore: 'private-helper', credHelpers: { 'docker.io': 'private-helper' } },
  { DOCKER_CONFIG: 'private-path', DOCKER_AUTH_CONFIG: 'private-auth' });
  expect(Object.values(summary).every(value => typeof value === 'boolean')).toBe(true);
  expect(summary).toMatchObject({ authOverride: true, canonicalHubEntry: true, hubHelper: true });
});

test('bounded config reader handles missing, malformed and oversized files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'classifarr-registry-config-'));
  const configEnv = { DOCKER_CONFIG: directory };
  try {
    expect((await readCredentialSummary(configEnv)).state).toBe('absent');
    await writeFile(join(directory, 'config.json'), '{private');
    expect((await readCredentialSummary(configEnv)).state).toBe('unreadable');
    await writeFile(join(directory, 'config.json'), 'x'.repeat(65537));
    expect((await readCredentialSummary(configEnv)).state).toBe('oversized');
    await writeFile(join(directory, 'config.json'), '{}');
    expect((await readCredentialSummary(configEnv)).state).toBe('read');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('probe consumes no body, does not follow redirects and reports fixed fields', async () => {
  const response = { statusCode: 302, destroy: jest.fn() };
  const requestFn = jest.fn((_url, _options, callback) => {
    const req = new EventEmitter(); req.end = () => queueMicrotask(() => callback(response));
    req.destroy = jest.fn(); return req;
  });
  const result = await probeRegistry('auth', { requestFn });
  expect(result).toMatchObject({ endpoint: 'auth', status: 302, code: 'response' });
  expect(response.destroy).toHaveBeenCalledTimes(1);
  expect(() => probeRegistry('https://private')).toThrow('unsupported_probe');
});

test('probe enforces its own deadline and discards network exception details', async () => {
  const req = new EventEmitter(); req.end = jest.fn(); req.destroy = jest.fn();
  const result = await probeRegistry('registry', { requestFn: () => req, timeoutMs: 10 });
  expect(result).toMatchObject({ status: null, code: 'timeout' });
  expect(req.destroy).toHaveBeenCalledTimes(1);
});

test('actual action CLI rejects missing credentials with nonzero exit and safe context', async () => {
  const entry = resolve(import.meta.dirname, '../../../../.github/actions/dockerhub-pull/index.mjs');
  const result = await registryCommand(process.execPath, [entry], { env: { ...process.env, ...env } });
  // registryCommand strips INPUT_* before spawning: no actual login is attempted.
  expect(result.ok).toBe(false);
  expect(result.stderr).toContain('credentials_missing');
  expect(result.stderr).not.toContain('fixture-secret');
});

test('actual subprocess uses stdin, strips input credentials and debug, never runs a shell', async () => {
  const result = await registryCommand(process.execPath, ['--input-type=module', '-e',
    "let input='';for await(const chunk of process.stdin)input+=chunk;console.log(JSON.stringify({input,secret:process.env.INPUT_PASSWORD,debug:process.env.DEBUG}));"],
  { input: 'test fixture', env: { ...process.env, INPUT_PASSWORD: 'private', DEBUG: '*' } });
  expect(result.ok).toBe(true);
  expect(JSON.parse(result.stdout)).toEqual({ input: 'test fixture' });
});

test('actual subprocess timeout, output overflow, launch failure and cancellation are bounded', async () => {
  const args = ['-e', 'setInterval(()=>{},1000)'];
  expect((await registryCommand(process.execPath, args, { timeoutMs: 80 })).timedOut).toBe(true);
  expect((await registryCommand(process.execPath, ['-e', "console.log('x'.repeat(100000))"], { maxBytes: 100 })).outputLimited).toBe(true);
  expect((await registryCommand('classifarr-nonexistent-fixture-command', [])).ok).toBe(false);
  const controller = new AbortController();
  const task = registryCommand(process.execPath, args, { signal: controller.signal });
  controller.abort();
  expect((await task).cancelled).toBe(true);
});

test('both real pull clients run; a CLI failure is not hidden by Testcontainers success', async () => {
  const command = jest.fn().mockResolvedValueOnce(failed('status code 500 private'))
    .mockResolvedValueOnce(success);
  const report = jest.fn();
  expect(await compareRegistryPulls({ command, report })).toBe(false);
  expect(command.mock.calls[0][1]).toEqual(['pull', '--quiet', CI_DATABASE_IMAGE]);
  expect(command.mock.calls[1][1]).toContain('--testcontainers');
  expect(JSON.stringify(report.mock.calls)).not.toContain('private');
});

test('Testcontainers child failures remain blocking and sanitized', async () => {
  const command = jest.fn().mockResolvedValueOnce(success)
    .mockResolvedValueOnce({ ok: false, stdout: 'credentials_rejected\n' });
  const report = jest.fn();
  expect(await compareRegistryPulls({ command, report })).toBe(false);
  expect(report.mock.calls[1][0].code).toBe('credentials_rejected');
});
