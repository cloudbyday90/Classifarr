/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import pino from 'pino';
import { buildPinoOptions } from '../utils/logging/pinoFactory.mjs';

test('real worker targets route numeric levels and preserve redaction', async () => {
    const root = realpathSync(tmpdir());
    const directory = mkdtempSync(join(root, 'classifarr-pino-'));
    const all = join(directory, 'all.log'), warnings = join(directory, 'warnings.log');
    const transport = pino.transport({ targets: [
        { target: 'pino/file', options: { destination: all }, level: 'info' },
        { target: 'pino/file', options: { destination: warnings }, level: 'warn' },
    ] });
    try {
        await once(transport, 'ready');
        const logger = pino(buildPinoOptions({ level: 'info' }), transport);
        logger.info({ password: 'PRIVATE_TEST_PASSWORD' }, 'info marker');
        logger.warn({ token: 'PRIVATE_TEST_TOKEN' }, 'warn marker');
        const closed = once(transport, 'close');
        transport.end();
        await closed;
        const raw = readFileSync(all, 'utf8');
        const records = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        expect(records.map(row => row.msg)).toEqual(['info marker', 'warn marker']);
        expect(records.map(row => row.level)).toEqual([30, 40]);
        expect(raw).not.toMatch(/PRIVATE_TEST/);
        expect(records[0].password).toBe('[REDACTED]');
        expect(JSON.parse(readFileSync(warnings, 'utf8').trim())).toMatchObject({ level: 40, msg: 'warn marker', token: '[REDACTED]' });
    } finally {
        if (!transport.destroyed) transport.destroy();
        const resolved = realpathSync(directory);
        if (dirname(resolved) !== root || !basename(resolved).startsWith('classifarr-pino-')) throw new Error('Unexpected test directory');
        rmSync(resolved, { recursive: true, force: true });
    }
});
