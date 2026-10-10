/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import { createConsoleSpy } from './setup/consoleHelpers.mjs';

let directory;

// Deliberately do not inherit host DOTENV_* settings or load the repository .env.
const runFixture = (args, environment = {}) => promisify(execFile)(process.execPath, args, {
    cwd: directory, timeout: 5000, maxBuffer: 64 * 1024, windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot, ...environment },
});
afterEach(async () => {
    jest.restoreAllMocks();
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = null;
});

test('side-effect import stays quiet and preserves externally supplied values', async () => {
    directory = await mkdtemp(join(tmpdir(), 'classifarr-dotenv-'));
    await writeFile(join(directory, '.env'), 'SYNTHETIC_ONLY=from_file\nADDED=value\n');
    const source = `import ${JSON.stringify(import.meta.resolve('dotenv/config'))};
        process.stdout.write(JSON.stringify([process.env.SYNTHETIC_ONLY, process.env.ADDED]));`;
    const { stdout, stderr } = await promisify(execFile)(process.execPath,
        ['--input-type=module', '--eval', source], {
            cwd: directory, timeout: 5000, maxBuffer: 64 * 1024, windowsHide: true,
            env: { SystemRoot: process.env.SystemRoot, SYNTHETIC_ONLY: 'external' },
        });
    expect(JSON.parse(stdout)).toEqual(['external', 'value']);
    expect(stderr).toBe('');
});

test('installed dotenv supports ESM parsing without populating the host environment', () => {
    expect(dotenv.parse('SYNTHETIC_ONLY="value # literal"\nEMPTY=\n# comment\n')).toEqual({
        SYNTHETIC_ONLY: 'value # literal', EMPTY: '',
    });
});

test('undefined path, quiet and override options retain the explicit environment settings', async () => {
    directory = await mkdtemp(join(tmpdir(), 'classifarr-dotenv-'));
    const file = join(directory, 'selected.env');
    await writeFile(file, 'SYNTHETIC_ONLY=selected_file\n');
    await writeFile(join(directory, '.env'), 'SYNTHETIC_ONLY=wrong_file\n');
    const source = `import dotenv from ${JSON.stringify(import.meta.resolve('dotenv'))};
        const result = dotenv.config({ path: undefined, quiet: undefined, override: undefined });
        process.stdout.write(JSON.stringify({ value: process.env.SYNTHETIC_ONLY, parsed: result.parsed }));`;
    const { stdout, stderr } = await runFixture(['--input-type=module', '--eval', source], {
        SYNTHETIC_ONLY: 'external', DOTENV_PATH: file, DOTENV_QUIET: 'true', DOTENV_OVERRIDE: 'true',
    });
    expect(JSON.parse(stdout)).toEqual({ value: 'selected_file', parsed: { SYNTHETIC_ONLY: 'selected_file' } });
    expect(stderr).toBe('');
});

test('explicit false options still override environment settings', async () => {
    directory = await mkdtemp(join(tmpdir(), 'classifarr-dotenv-'));
    await writeFile(join(directory, '.env'), 'SYNTHETIC_ONLY=from_file\n');
    const source = `import dotenv from ${JSON.stringify(import.meta.resolve('dotenv'))};
        dotenv.config({ quiet: false, override: false });
        process.stdout.write(JSON.stringify(process.env.SYNTHETIC_ONLY));`;
    const { stdout, stderr } = await runFixture(['--input-type=module', '--eval', source], {
        SYNTHETIC_ONLY: 'external', DOTENV_QUIET: 'true', DOTENV_OVERRIDE: 'true',
    });
    expect(JSON.parse(stdout)).toBe('external');
    expect(stderr).toContain('injected env');
});

test.each(['DOTENV_QUIET', 'DOTENV_CONFIG_QUIET'])('CLI honors %s loaded from a synthetic env file', async setting => {
    directory = await mkdtemp(join(tmpdir(), 'classifarr-dotenv-'));
    await writeFile(join(directory, '.env'), `${setting}=true\nSYNTHETIC_ONLY=from_file\n`);
    const { stdout, stderr } = await runFixture([
        fileURLToPath(import.meta.resolve('dotenv')), 'run', '--', process.execPath,
        '--input-type=module', '--eval', 'process.stdout.write(process.env.SYNTHETIC_ONLY)',
    ]);
    expect(stdout).toBe('from_file');
    expect(stderr).toBe('');
});

test('CLI preserves explicit shell quiet=false even when the file overrides it', async () => {
    directory = await mkdtemp(join(tmpdir(), 'classifarr-dotenv-'));
    await writeFile(join(directory, '.env'), 'DOTENV_QUIET=true\nSYNTHETIC_ONLY=from_file\n');
    const { stdout, stderr } = await runFixture([
        fileURLToPath(import.meta.resolve('dotenv')), 'run', '--override', '--', process.execPath,
        '--input-type=module', '--eval', 'process.stdout.write(process.env.SYNTHETIC_ONLY)',
    ], { DOTENV_QUIET: 'false' });
    expect(stdout).toBe('from_file');
    expect(stderr).toContain('injected env');
});

test.each(['path', 'url'])('quiet configuration accepts a file %s and preserves external precedence', async kind => {
    directory = await mkdtemp(join(tmpdir(), 'classifarr-dotenv-'));
    const file = join(directory, '.env');
    await writeFile(file, 'SYNTHETIC_ONLY=from_file\nADDED=value\n');
    const target = { SYNTHETIC_ONLY: 'external' };
    const result = dotenv.config({ path: kind === 'url' ? pathToFileURL(file) : file, quiet: true, processEnv: target });
    expect(result.error).toBeUndefined();
    expect(result.parsed).toEqual({ SYNTHETIC_ONLY: 'from_file', ADDED: 'value' });
    expect(target).toEqual({ SYNTHETIC_ONLY: 'external', ADDED: 'value' });
});

test.each([undefined, false, 'false', '0'])('populate preserves external values when override is %s', override => {
    const target = { SYNTHETIC_ONLY: 'external', EMPTY: '' };
    const parsed = { SYNTHETIC_ONLY: 'from_file', EMPTY: 'from_file', ADDED: 'value' };
    dotenv.populate(target, parsed, { override });
    expect(target).toEqual({ SYNTHETIC_ONLY: 'external', EMPTY: '', ADDED: 'value' });
    expect(parsed).toEqual({ SYNTHETIC_ONLY: 'from_file', EMPTY: 'from_file', ADDED: 'value' });
});

test.each([true, 'true', '1'])('populate retains explicit override support for %s', override => {
    const target = { SYNTHETIC_ONLY: 'external' };
    dotenv.populate(target, { SYNTHETIC_ONLY: 'from_file' }, { override });
    expect(target).toEqual({ SYNTHETIC_ONLY: 'from_file' });
});

test('string false disables populate debug output as well as override', () => {
    const log = createConsoleSpy('log', { suppress: true });
    const error = createConsoleSpy('error', { suppress: true });
    const target = { SYNTHETIC_ONLY: 'external' };
    dotenv.populate(target, { SYNTHETIC_ONLY: 'from_file' }, { debug: 'false', override: 'false' });
    expect(log.spy).not.toHaveBeenCalled();
    expect(error.spy).not.toHaveBeenCalled();
    expect(target.SYNTHETIC_ONLY).toBe('external');
});

test('a missing optional env file reports an error without changing supplied values', async () => {
    directory = await mkdtemp(join(tmpdir(), 'classifarr-dotenv-'));
    const target = { SYNTHETIC_ONLY: 'external' };
    const result = dotenv.config({ path: join(directory, 'missing.env'), quiet: true, processEnv: target });
    expect(result.error?.code).toBe('ENOENT');
    expect(result.parsed).toEqual({});
    expect(target).toEqual({ SYNTHETIC_ONLY: 'external' });
});
