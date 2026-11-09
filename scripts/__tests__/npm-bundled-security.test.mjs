/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { npmContext, execute } from './helpers/npmFixture.mjs';

test('the executing npm distribution owns the reviewed parser and downloader transport', async () => {
  const context = npmContext();
  const json = async path => JSON.parse(await readFile(path, 'utf8'));
  assert.equal((await json(resolve(context.root, 'package.json'))).version, '12.2.2');
  assert.equal((await json(resolve(dirname(context.parser), '../package.json'))).version, '10.7.5');
  assert.equal((await json(resolve(dirname(context.undici), 'package.json'))).version, '6.29.1');
  const { stdout } = await execute(process.execPath, [resolve(dirname(context.cli), 'npx-cli.js'), '--version'],
    { timeout: 10000, maxBuffer: 8192, windowsHide: true });
  assert.equal(stdout.trim(), '12.2.2');
});
for (const mode of ['parser', 'tls', 'encoding']) {
  test(`actual npm bundle preserves ${mode} security and ordinary controls`, async () => {
    const { stdout, stderr } = await execute(process.execPath, ['--max-old-space-size=128',
      fileURLToPath(new URL('./fixtures/npmBundledProbe.mjs', import.meta.url)), npmContext().cli, mode], {
      env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, OPENSSL_BIN: process.env.OPENSSL_BIN },
      timeout: 15000, maxBuffer: 32768, windowsHide: true,
    });
    assert.deepEqual(JSON.parse(stdout), { mode, passed: true }); assert.equal(stderr, '');
  });
}
