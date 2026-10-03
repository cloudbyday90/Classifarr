/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';

let directory;
afterEach(async () => {
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
