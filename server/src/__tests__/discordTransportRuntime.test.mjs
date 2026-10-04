/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const cases = [
  ['discord.js', 'discordUndiciFixture.mjs', 6],
  ['@discordjs/rest', 'discordUndiciFixture.mjs', 6],
  ['Discord REST', 'discordRestFixture.mjs', 1],
  ['Bounded Discord REST', 'discordBoundedRestFixture.mjs', 13],
];

test.each(cases)('%s uses the actual transport with bounded loopback I/O', async (consumer, filename, count) => {
  const fixture = fileURLToPath(new URL(`./fixtures/${filename}`, import.meta.url));
  // Run the node:test module directly: no grandchild can outlive execFile's timeout.
  const { stdout, stderr } = await execute(process.execPath, ['--max-old-space-size=128', '--test-reporter=tap', fixture], {
    timeout: 15000, maxBuffer: 256 * 1024, windowsHide: true,
    // No inherited bot credentials, proxies or NODE_OPTIONS; never login to Discord.
    env: { SystemRoot: process.env.SystemRoot, NODE_ENV: 'test', CLASSIFARR_DISCORD_TRANSPORT_FIXTURE: consumer },
  }).catch(error => {
    throw new Error(`Discord transport fixture failed (${consumer}):\n${error.stdout}\n${error.stderr}`, { cause: error });
  });
  expect(stderr).toBe('');
  expect(stdout).toContain(`# pass ${count}`);
  expect(stdout).toContain('# fail 0');
  expect(stdout).toContain('# skipped 0');
}, 20000);
