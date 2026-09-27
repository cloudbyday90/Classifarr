/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { main as replaySchema } from '../../scripts/runSchemaReleaseReplay.mjs';
import { main as rehearseProfiles } from '../../scripts/runLibraryProfileUpgradeRehearsal.mjs';

test('importing rehearsal entry points does not start application file logging', () => {
    const entries = ['runSchemaReleaseReplay.mjs', 'runLibraryProfileUpgradeRehearsal.mjs']
        .map(name => new URL(`../../scripts/${name}`, import.meta.url).href);
    const output = execFileSync(process.execPath, ['--input-type=module', '--eval', `
        for (const entry of ${JSON.stringify(entries)}) await import(entry);
        process.stdout.write(process.env.FILE_LOGGING_ENABLED);
    `], { encoding: 'utf8', timeout: 15000,
        env: { ...process.env, NODE_ENV: 'production', FILE_LOGGING_ENABLED: 'true',
            // A file, not a writable directory: accidental transport startup fails.
            LOG_DIR: import.meta.filename } });
    expect(output).toBe('true');
});

test.each([['schema replay', replaySchema], ['profile rehearsal', rehearseProfiles]])(
    '%s configures stdout-only logging before loading its application runtime', async (_name, main) => {
        const saved = process.env.FILE_LOGGING_ENABLED;
        process.env.FILE_LOGGING_ENABLED = 'true';
        const loadRuntime = jest.fn(async () => {
            expect(process.env.FILE_LOGGING_ENABLED).toBe('false');
            throw new Error('isolated runtime probe');
        });
        try {
            await expect(main({ loadRuntime })).rejects.toThrow('isolated runtime probe');
            expect(loadRuntime).toHaveBeenCalledTimes(1);
        } finally {
            if (saved === undefined) delete process.env.FILE_LOGGING_ENABLED;
            else process.env.FILE_LOGGING_ENABLED = saved;
        }
    },
);
