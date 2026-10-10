/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { PassThrough, Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadSourceCatalogScopePlanInput } from '../scripts/sourceCatalogScopePlanInput.mjs';
import { runSourceIdentityExternalEvidenceReplay } from '../scripts/runSourceIdentityExternalEvidenceReplay.mjs';

const input = { version: 'source_catalog_scope_plan.v1', intent: 'preserve_source_grouping',
  source: { mediaServerId: 1, externalId: 'private-source', mediaType: 'movie', identityDigest: 'a'.repeat(64) },
  scope: { kind: 'whole_work', tmdbId: 10 } };

test('reads bounded UTF-8 JSON; standalone review does not initialize a runtime', async () => {
  const value = await loadSourceCatalogScopePlanInput({ stdin: Readable.from([Buffer.from(JSON.stringify(input))]) });
  const loadRuntime = jest.fn();
  const report = await runSourceIdentityExternalEvidenceReplay({ argv: ['--scope-plan'], loadRuntime,
    loadPlan: async () => value });
  expect(report.status.id).toBe('valid_draft');
  expect(report.canApply).toBe(false);
  expect(loadRuntime).not.toHaveBeenCalled();
});

test.each([[], ['--cross-references']].map(argv => [argv]))('existing modes never read proposal stdin: %j', async argv => {
  const loadPlan = jest.fn(); const close = jest.fn();
  const replay = jest.fn().mockResolvedValue({ status: { id: 'complete' } });
  await runSourceIdentityExternalEvidenceReplay({ argv, loadPlan, loadRuntime: async () => ({ replay: { replay }, close }) });
  expect(loadPlan).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
});

test.each([['--scope-plan', '--cross-references'], ['--scope-plan', 'private-file'], ['--apply'], ['--scope-plan', '--apply']].map(argv => [argv]))(
  'rejects unsupported arguments before reading anything: %j', async argv => {
    const loadPlan = jest.fn(); const loadRuntime = jest.fn();
    await expect(runSourceIdentityExternalEvidenceReplay({ argv, loadPlan, loadRuntime })).rejects.toThrow('invalid_arguments');
    expect(loadPlan).not.toHaveBeenCalled(); expect(loadRuntime).not.toHaveBeenCalled();
  });

test.each([
  [Buffer.from('private-secret invalid json'), 'valid JSON'],
  [Buffer.from([0xc3, 0x28]), 'valid UTF-8'],
  [Buffer.alloc(32769, 65), 'allowed size'],
])('rejects unsafe input without repeating contents', async (bytes, message) => {
  await expect(loadSourceCatalogScopePlanInput({ stdin: Readable.from([bytes]) })).rejects.toThrow(message);
});

test('counts UTF-8 bytes across chunks, not characters', async () => {
  await expect(loadSourceCatalogScopePlanInput({ stdin: Readable.from([Buffer.alloc(20000, 65), Buffer.alloc(12769, 65)]) }))
    .rejects.toThrow('allowed size');
  const bytes = Buffer.from(`"${'é'.repeat(16384)}"`);
  await expect(loadSourceCatalogScopePlanInput({ stdin: Readable.from([bytes]) })).rejects.toThrow('allowed size');
});

test('accepts the exact byte limit and rejects one additional byte', async () => {
  const json = JSON.stringify(input).padEnd(32768, ' ');
  await expect(loadSourceCatalogScopePlanInput({ stdin: Readable.from([Buffer.from(json)]) })).resolves.toEqual(input);
  await expect(loadSourceCatalogScopePlanInput({ stdin: Readable.from([Buffer.from(`${json} `)]) })).rejects.toThrow('allowed size');
});

test('interrupts a stalled pipe with no database activity', async () => {
  const stdin = new PassThrough();
  await expect(loadSourceCatalogScopePlanInput({ stdin, timeoutMs: 20 })).rejects.toMatchObject({ name: 'AbortError' });
  expect(stdin.destroyed).toBe(true);
});

function runCli(body, args = ['--scope-plan']) {
  return new Promise((resolve, reject) => {
    const cli = fileURLToPath(new URL('../scripts/runSourceIdentityExternalEvidenceReplay.mjs', import.meta.url));
    const child = spawn(process.execPath, [cli, ...args], { shell: false,
      env: { ...process.env, DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/invalid', NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.stdin.end(body);
  });
}

test('real standalone CLI exits successfully with aggregate-only output and unusable database configuration', async () => {
  const result = await runCli(JSON.stringify(input));
  expect(result.code).toBe(0); expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({ status: { id: 'valid_draft' }, canApply: false });
  expect(result.stdout).not.toMatch(/private-source|postgres|identityDigest/);
});

test.each(['{"private-secret":true}', 'private-secret-invalid', 'x'.repeat(32769)])('real CLI rejects invalid input without exposing it', async body => {
  const result = await runCli(body);
  expect(result.code).toBe(1);
  expect(result.stdout + result.stderr).not.toMatch(/private-secret|xxxxx|postgres/);
});
