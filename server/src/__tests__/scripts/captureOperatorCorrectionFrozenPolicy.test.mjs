/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { access, readFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const boundary = await import('../../scripts/privateStudyFileBoundary.mjs');
const writePrivateStudyJsonFile = jest.fn();
jest.unstable_mockModule('../../scripts/privateStudyFileBoundary.mjs', () => ({ ...boundary, writePrivateStudyJsonFile }));
const { runFrozenPolicyCapture } = await import('../../scripts/captureOperatorCorrectionFrozenPolicy.mjs');
const created = new Set();
const envKeys = ['LOG_LEVEL', 'FILE_LOGGING_ENABLED', 'PGOPTIONS'];
let savedEnvironment;
const input = () => ({ cases: [{ privateTitle: 'Synthetic private title' }], eligibleCorrections: 2,
  folds: [[], [], []], sourceFingerprint: 'source', sampleFingerprint: 'sample' });
async function write(outputFile, document, options) {
  created.add(dirname(resolve(boundary.PRIVATE_STUDY_ROOT, outputFile)));
  return boundary.writePrivateStudyJsonFile(outputFile, document, options);
}
beforeEach(() => {
  savedEnvironment = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  writePrivateStudyJsonFile.mockReset().mockImplementation(write);
});
afterEach(async () => {
  for (const key of envKeys) {
    if (savedEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnvironment[key];
  }
  for (const directory of created) {
    expect(relative(boundary.PRIVATE_STUDY_ROOT, directory)).toMatch(/^\.tmp[/\\]frozen-policy-[^/\\]+$/);
    await rm(directory, { recursive: true, force: true });
  }
  created.clear();
});

test('capture uses the shared guarded writer and returns only a private path and aggregate receipt', async () => {
  const document = input(), capture = jest.fn().mockResolvedValue(document);
  const result = await runFrozenPolicyCapture({ argv: [], capture });
  expect(result).toEqual({ inputFile: expect.stringMatching(/^\.tmp\/frozen-policy-[^/]+\/input\.json$/),
    sampled: 1, eligibleCorrections: 2, folds: 3, sourceFingerprint: 'source', sampleFingerprint: 'sample' });
  expect(JSON.stringify(result)).not.toContain('Synthetic private title');
  expect(writePrivateStudyJsonFile).toHaveBeenCalledWith(result.inputFile, document, { label: 'Frozen-policy capture' });
  expect(JSON.parse(await readFile(resolve(boundary.PRIVATE_STUDY_ROOT, result.inputFile), 'utf8'))).toEqual(document);
  if (process.platform !== 'win32') expect((await stat(resolve(boundary.PRIVATE_STUDY_ROOT, result.inputFile))).mode & 0o777).toBe(0o600);
  expect(capture).toHaveBeenCalledWith(expect.objectContaining({ size: 100, folds: 3, generateCases: 0 }));
  expect(process.env.PGOPTIONS).toContain('default_transaction_read_only=on');
  expect(process.env.FILE_LOGGING_ENABLED).toBe('false');
});

test('successive captures use different directories without replacing earlier evidence', async () => {
  const first = await runFrozenPolicyCapture({ argv: [], capture: async () => input() });
  const second = await runFrozenPolicyCapture({ argv: [], capture: async () => ({ ...input(), sourceFingerprint: 'new' }) });
  expect(second.inputFile).not.toBe(first.inputFile);
  expect(JSON.parse(await readFile(resolve(boundary.PRIVATE_STUDY_ROOT, first.inputFile), 'utf8')).sourceFingerprint).toBe('source');
});

test('invalid options cannot start a capture or write evidence', async () => {
  const capture = jest.fn();
  await expect(runFrozenPolicyCapture({ argv: ['--size', '0'], capture })).rejects.toThrow('description_benchmark_options_invalid');
  expect(capture).not.toHaveBeenCalled();
  expect(writePrivateStudyJsonFile).not.toHaveBeenCalled();
});

test('a capture failure does not attempt a file write', async () => {
  await expect(runFrozenPolicyCapture({ argv: [], capture: async () => { throw new Error('capture_failed'); } })).rejects.toThrow('capture_failed');
  expect(writePrivateStudyJsonFile).not.toHaveBeenCalled();
});

test.each(['../escape-', '/absolute-', 'nested/path-', 'missingSuffix', '', null])('private directory rejects invalid prefix %s before filesystem work', async prefix => {
  await expect(boundary.createPrivateStudyDirectory(prefix)).rejects.toThrow('private_study_directory_prefix_invalid');
});

test.each(['serialization', 'write'])('%s failure cleans up only the newly created capture directory', async failure => {
  const document = input();
  if (failure === 'serialization') document.cycle = document;
  else writePrivateStudyJsonFile.mockImplementationOnce(async (...args) => {
    await write(...args);
    throw new Error('write_failed');
  });
  await expect(runFrozenPolicyCapture({ argv: [], capture: async () => document })).rejects.toThrow();
  expect(created.size).toBe(1);
  await expect(access([...created][0])).rejects.toMatchObject({ code: 'ENOENT' });
});

test.each(['production', 'test'])('%s storage root matches the shared private-study location', mode => {
  const moduleUrl = new URL('../../scripts/privateStudyFileBoundary.mjs', import.meta.url);
  const source = `import { PRIVATE_STUDY_ROOT } from ${JSON.stringify(moduleUrl.href)}; process.stdout.write(PRIVATE_STUDY_ROOT);`;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    env: { ...process.env, NODE_ENV: mode }, encoding: 'utf8', timeout: 5000,
  });
  const serverRoot = fileURLToPath(new URL('../../../', import.meta.url));
  expect(result).toBe(mode === 'production' ? resolve(serverRoot, 'data') : resolve(serverRoot, '..'));
});
