/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';
import { npmFixture, packFixture, loopback, execute } from './helpers/npmFixture.mjs';

const output = result => JSON.parse(result.stdout.trim());
for (const [form, bin, command] of [['string', 'bin.mjs', 'classifarr-bin-control'],
  ['object', { 'owned-bin': 'bin.mjs' }, 'owned-bin']]) {
  test(`real npm preserves ${form} bins, argv, exit status and adjacent files`, async () => {
    const fixture = await npmFixture();
    try {
      const pkg = await packFixture(fixture, { name: 'classifarr-bin-control', bin });
      await fixture.npm(['install', pkg.path]);
      const sentinel = resolve(fixture.directory, 'node_modules/.bin/adjacent-sentinel.txt');
      await writeFile(sentinel, 'preserved');
      assert.deepEqual(output(await fixture.npm(['exec', '--', command, 'ordinary', 'space value'])),
        { kind: 'fixture', args: ['ordinary', 'space value'] });
      await assert.rejects(fixture.npm(['exec', '--', command, 'exit13']), error => error.code === 13);
      assert.deepEqual(output(await fixture.npm(['exec', '--', command, 'recovered'])), { kind: 'fixture', args: ['recovered'] });
      await fixture.npm(['uninstall', pkg.name]);
      for (const suffix of ['', '.cmd', '.ps1']) assert.equal(existsSync(resolve(fixture.directory, 'node_modules/.bin', command + suffix)), false);
      assert.equal(await readFile(sentinel, 'utf8'), 'preserved');
    } finally { await fixture.close(); }
  });
}

test('public offline peer solving accepts matching peers and refuses a direct conflict', async () => {
  const fixture = await npmFixture();
  try {
    const host = await packFixture(fixture, { name: 'classifarr-peer-host' });
    const matching = await packFixture(fixture, { name: 'classifarr-peer-match', peerDependencies: { 'classifarr-peer-host': '1.0.0' } });
    const conflicting = await packFixture(fixture, { name: 'classifarr-peer-conflict', peerDependencies: { 'classifarr-peer-host': '2.0.0' } });
    await fixture.npm(['install', host.path, matching.path]);
    await assert.rejects(fixture.npm(['install', conflicting.path]), error => /ERESOLVE/.test(error.stderr));
    const tree = output(await fixture.npm(['ls', '--all', '--json']));
    assert.equal(tree.dependencies['classifarr-peer-host'].version, '1.0.0');
    assert.equal(tree.dependencies['classifarr-peer-conflict'], undefined);
    for (const key of ['strict-peer-deps', 'legacy-peer-deps']) assert.equal((await fixture.npm(['config', 'get', key])).stdout.trim(), 'false');
  } finally { await fixture.close(); }
});

test('npx exact cache hits use the installed bin after mutable registry metadata changes', async () => {
  const fixture = await npmFixture(); let registry;
  try {
    const pkg = await packFixture(fixture, { name: 'classifarr-cache-bin', bin: { 'cache-good': 'bin.mjs' } });
    let changed = false, reads = 0;
    registry = await loopback((req, res) => {
      if (req.url === '/fixture.tgz') { res.end(pkg.bytes); return; }
      reads++; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'max-age=0');
      res.end(JSON.stringify({ name: pkg.name, 'dist-tags': { latest: pkg.version }, versions: { [pkg.version]: {
        name: pkg.name, version: pkg.version, bin: { [changed ? 'cache-decoy' : 'cache-good']: 'bin.mjs' },
        dist: { tarball: registry.origin + '/fixture.tgz', integrity: 'sha512-' + createHash('sha512').update(pkg.bytes).digest('base64') },
      } } }));
    });
    const origin = registry.origin;
    assert.deepEqual(output(await fixture.npm(['exec', '--yes', `--registry=${origin}`, `${pkg.name}@${pkg.version}`], { online: true })),
      { kind: 'fixture', args: [] });
    changed = true;
    const refreshed = output(await fixture.npm(['view', `${pkg.name}@${pkg.version}`, 'bin', '--json', '--prefer-online', `--registry=${origin}`], { online: true }));
    assert.deepEqual(refreshed, [{ 'cache-decoy': 'bin.mjs' }]); assert.ok(reads >= 2);
    const decoy = resolve(fixture.directory, 'decoy'); await mkdir(decoy);
    await writeFile(join(decoy, 'decoy.mjs'), "process.stdout.write(JSON.stringify({kind:'decoy'})+'\\n');\n");
    if (process.platform === 'win32') await writeFile(join(decoy, 'cache-decoy.cmd'), '@node "%~dp0decoy.mjs" %*\r\n');
    else { await writeFile(join(decoy, 'cache-decoy'), '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({kind:"decoy"})+"\\n");\n'); await chmod(join(decoy, 'cache-decoy'), 0o755); }
    const extraEnv = { PATH: decoy + delimiter + fixture.env.PATH };
    assert.deepEqual(output(await fixture.npm(['exec', '--yes', '--prefer-online', `--registry=${origin}`, `${pkg.name}@${pkg.version}`],
      { online: true, extraEnv })), { kind: 'fixture', args: [] });
    await registry.close(); registry = null;
    assert.deepEqual(output(await fixture.npm(['exec', '--yes', `--registry=${origin}`, `${pkg.name}@${pkg.version}`],
      { extraEnv })), { kind: 'fixture', args: [] });
  } finally { await registry?.close(); await fixture.close(); }
});

test('literal executable names and arguments survive the real platform shell', async () => {
  const fixture = await npmFixture();
  try {
    const names = process.platform === 'win32' ? ['literal&bin', 'literal^bin', 'literal bin'] : ['literal&bin', "literal'bin", 'literal bin'];
    const forbidden = process.platform === 'win32' ? ['forbidden%bin', 'forbidden!bin'] : [];
    const pkg = await packFixture(fixture, { name: 'classifarr-shell-control', bin: Object.fromEntries([...names, ...forbidden].map(name => [name, 'bin.mjs'])) });
    await fixture.npm(['install', pkg.path]);
    const args = ['space value', 'literal&value', "apostrophe'value", '$(synthetic)', '“quoted”'];
    for (const name of names) assert.deepEqual(output(await fixture.npm(['exec', '--', name, ...args])), { kind: 'fixture', args });
    if (process.platform === 'win32') {
      for (const name of forbidden) await assert.rejects(fixture.npm(['exec', '--', name]), error => /EINVALIDCOMMAND/.test(error.stderr) && !error.stdout.includes('fixture'));
      const { stdout } = await execute('where.exe', ['pwsh.exe'], { timeout: 5000, maxBuffer: 8192, windowsHide: true });
      const shell = stdout.trim().split(/\r?\n/)[0]; assert.equal(existsSync(shell), true);
      for (const name of names) assert.deepEqual(output(await fixture.npm(['exec', `--script-shell=${shell}`, '--', name, ...args])), { kind: 'fixture', args });
    }
  } finally { await fixture.close(); }
});
