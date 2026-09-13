/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { expect, jest, test } from '@jest/globals';
import { runWorkspaceTests, summarizeResults } from '../../../scripts/run-workspace-tests.mjs';
import { withConsoleSpy } from './setup/consoleHelpers.mjs';

const { scripts } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
const preflightScripts = ['check-copyright', 'lint:server:dependencies', 'lint:server:dependencies:production'];

test('local CI runs the same copyright and dependency checks before behavioral tests', () => {
    expect(scripts['test:ci']).toMatch(/^npm run test:ci:preflight && /u);
    expect(scripts['test:ci:preflight']).toBe(`node scripts/run-workspace-tests.mjs ${preflightScripts.join(' ')}`);
    expect(scripts['check-copyright']).toBe('node scripts/check-copyright.mjs');
    expect(scripts['lint:server:dependencies']).toBe('npm --prefix server run lint:knip');
    expect(scripts['lint:server:dependencies:production']).toBe('npm --prefix server run lint:knip:production');
});

test('preflight attempts every gate but preserves a failed exit status without using a shell', async () => {
    const spawnProcess = jest.fn((_command, args, options) => {
        expect(options.shell).toBe(false);
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('exit', args.at(-1) === preflightScripts[0] ? 1 : 0));
        return child;
    });
    const results = await runWorkspaceTests(preflightScripts, { platform: 'linux', spawnProcess });
    expect(results.map(result => result.scriptName)).toEqual(preflightScripts);
    expect(results.map(result => result.code)).toEqual([1, 0, 0]);
    await withConsoleSpy('log', { suppress: true }, () => {
        expect(summarizeResults(results)).toBe(1);
    });
});
