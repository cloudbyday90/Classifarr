/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, test } from '@jest/globals';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

let directory;
afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = null;
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
