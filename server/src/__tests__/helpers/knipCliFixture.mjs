/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const knipCli = fileURLToPath(new URL('../../../node_modules/knip/bin/knip.js', import.meta.url));
const childEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE)$/i.test(key))),
  CI: 'true',
  NO_COLOR: '1',
};

export function withFixture(files, run, { manifest = {}, config = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'classifarr-knip-contract-'));
  const contents = {
    'package.json': JSON.stringify({ name: 'classifarr-knip-fixture', private: true, type: 'module', ...manifest }),
    'knip.json': JSON.stringify({ entry: ['entry.mjs!'], project: ['*.mjs!'], tags: ['-lintignore'], ...config }),
    ...files,
  };
  try {
    for (const [path, content] of Object.entries(contents)) {
      const target = join(directory, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    run(directory);
  } finally {
    // Only the directory just created by this test is removed, never the repo.
    rmSync(directory, { recursive: true, force: true });
  }
}

export function runKnip(directory, args = []) {
  const result = spawnSync(process.execPath, [knipCli, '--reporter', 'json', '--no-progress', ...args], {
    cwd: directory,
    env: childEnv,
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  expect(result.signal).toBeNull();
  return result;
}

export function reported(result, type) {
  return JSON.parse(result.stdout).issues.flatMap(issue =>
    (issue[type] ?? []).map(item => `${issue.file.replaceAll('\\', '/')}:${item.name}`)).sort();
}
