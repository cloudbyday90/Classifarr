/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { dirname, delimiter, resolve, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createServer } from 'node:http';

export const execute = promisify(execFile);
export const repository = fileURLToPath(new URL('../../../', import.meta.url));
export function npmContext(cli = process.env.npm_execpath) {
  assert.ok(cli && isAbsolute(cli), 'Run this suite through the reviewed npm CLI');
  const require = createRequire(cli);
  const socks = require.resolve('socks');
  const downloader = require.resolve('node-gyp/lib/download.js');
  return { cli, require, root: dirname(dirname(cli)), parser: createRequire(socks).resolve('ip-address'),
    undici: createRequire(downloader).resolve('undici'), pacote: require('pacote') };
}
export async function npmFixture() {
  const boundary = resolve(repository, '.tmp');
  await mkdir(boundary, { recursive: true });
  const directory = await mkdtemp(resolve(boundary, 'npm-1222-test-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP)$/i.test(key)));
  const userConfig = resolve(directory, 'user.npmrc'), globalConfig = resolve(directory, 'global.npmrc');
  for (const file of [userConfig, globalConfig]) await writeFile(file, '');
  Object.assign(env, { npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig,
    npm_config_cache: resolve(directory, 'cache'), HOME: directory, USERPROFILE: directory,
    PATH: dirname(process.execPath) + delimiter + (env.PATH ?? env.Path ?? ''),
    CI: 'true', NO_COLOR: '1', POWERSHELL_TELEMETRY_OPTOUT: '1' });
  await writeFile(resolve(directory, '.npmrc'), 'strict-allow-scripts=true\n');
  await writeFile(resolve(directory, 'package.json'), JSON.stringify({ name: 'classifarr-owned-fixture', private: true }));
  const { cli } = npmContext();
  const npm = (args, { cwd = directory, online = false, extraEnv = {} } = {}) => execute(process.execPath,
    [cli, ...(online ? ['--fetch-retries=0', '--fetch-timeout=2000'] : ['--offline']), '--no-audit', '--no-fund', ...args],
    { cwd, env: { ...env, ...extraEnv }, shell: false, windowsHide: true, timeout: 30000, maxBuffer: 65536 });
  return { directory, env, npm, async close() {
    assert.ok(directory.startsWith(boundary + sep) && directory !== boundary);
    await rm(directory, { recursive: true, force: true });
  } };
}
export async function loopback(handler) {
  const sockets = new Set(), server = createServer(handler);
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, async close() {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => { server.close(resolve); });
  } };
}

export async function packFixture(fixture, { name, version = '1.0.0', bin, peerDependencies } = {}) {
  assert.match(name, /^[a-z][a-z0-9-]{1,60}$/); assert.match(version, /^\d+\.\d+\.\d+$/);
  const directory = resolve(fixture.directory, `${name}-${version}`);
  await mkdir(directory);
  await writeFile(resolve(directory, 'package.json'), JSON.stringify({ name, version, type: 'module', bin, peerDependencies }));
  await writeFile(resolve(directory, 'bin.mjs'), '#!/usr/bin/env node\n' +
    "const args=process.argv.slice(2);process.stdout.write(JSON.stringify({kind:'fixture',args})+'\\n');if(args[0]==='exit13')process.exitCode=13;\n");
  const { stdout } = await fixture.npm(['pack', '--ignore-scripts', '--json'], { cwd: directory });
  const packed = JSON.parse(stdout);
  assert.equal(Object.keys(packed).length, 1); assert.equal(packed[name].version, version);
  const filename = packed[name].filename;
  assert.match(filename, /^[a-z0-9.-]+\.tgz$/);
  const path = resolve(directory, filename);
  return { name, version, path, bytes: await readFile(path) };
}
