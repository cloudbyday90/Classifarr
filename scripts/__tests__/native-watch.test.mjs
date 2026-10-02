/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('native dev watcher restarts imported ESM and shuts down its subprocesses', { timeout: 20_000 }, async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'classifarr-watch-'));
  const manifest = JSON.parse(readFileSync(new URL('../../server/package.json', import.meta.url), 'utf8'));
  const [command, ...args] = manifest.scripts.dev.split(' ');
  assert.equal(command, 'node');
  assert.equal(args.pop(), 'src/index.mjs');
  writeFileSync(resolve(directory, 'value.mjs'), "export const value = 'first';\n");
  writeFileSync(resolve(directory, 'entry.mjs'), [
    "import {value} from './value.mjs';",
    "console.log(`READY:${process.pid}:${value}`);",
    'setInterval(() => {}, 1000);', '',
  ].join('\n'));
  const watcher = spawn(process.execPath, [...args, 'entry.mjs'],
    { cwd: directory, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(watcher, 'close');
  let output = '';
  watcher.stdout.on('data', chunk => { output += chunk; });
  watcher.stderr.on('data', chunk => { output += chunk; });
  const waitFor = async pattern => {
    const deadline = Date.now() + 7_000;
    while (!pattern.test(output)) {
      assert.ok(Date.now() < deadline && watcher.exitCode === null, output);
      await new Promise(resolveWait => setTimeout(resolveWait, 50));
    }
  };
  try {
    await waitFor(/READY:\d+:first/);
    // Node reports readiness before setting up its watcher; let that settle.
    await new Promise(resolveWait => setTimeout(resolveWait, 300));
    writeFileSync(resolve(directory, 'value.mjs'), "export const value = 'second';\n");
    await waitFor(/READY:\d+:second/);
    const pids = [...output.matchAll(/READY:(\d+):/g)].map(([, pid]) => Number(pid));
    assert.equal(new Set(pids).size, 2, output);
    if (process.platform === 'win32') {
      const stopped = spawnSync('taskkill.exe', ['/PID', String(watcher.pid), '/T', '/F'],
        { shell: false, windowsHide: true, encoding: 'utf8', timeout: 5_000 });
      assert.equal(stopped.status, 0, stopped.stderr);
    } else watcher.kill('SIGTERM');
    await closed;
    for (const pid of pids) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally {
    if (watcher.exitCode === null && watcher.signalCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(watcher.pid), '/T', '/F'],
        { shell: false, windowsHide: true, stdio: 'ignore', timeout: 5_000 });
      else watcher.kill('SIGTERM');
      await closed;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
