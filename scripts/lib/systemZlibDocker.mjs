/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { mkdirSync } from 'node:fs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';

export const repository = resolve(import.meta.dirname, '../..');
export const fixture = resolve(repository, 'scripts/fixtures/systemZlib');
export function docker(args, timeoutMs = 30000) {
  const result = runDockerCheckCommand(args, { timeoutMs });
  if (!result.ok) throw new Error(`system_zlib_docker_failed:${args[0]}`);
  return result.stdout.trim();
}

/** Only a new random, label-bound container; no volumes, external network or user commands. */
export function runZlibContainer(imageId, args, { mounts = [], timeoutMs = 30000, platform } = {}) {
  assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
  const suffix = randomBytes(16).toString('hex'), name = `classifarr-zlib-${suffix}`;
  const label = `classifarr.zlib-check=${suffix}`;
  const filter = ['--filter', `name=^/${name}$`];
  assert.equal(docker(['ps', '-aq', ...filter]), '', 'system_zlib_name_collision');
  try {
    return docker(['run', '--rm', '--name', name, '--label', label,
      ...(platform ? ['--platform', platform] : []), '--network', 'none', '--read-only', '--no-healthcheck',
      '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--memory', '1g', '--cpus', '2', '--pids-limit', '128', '--tmpfs', '/tmp:rw,nosuid,nodev,exec,size=512m',
      ...mounts.flatMap(path => ['--mount', `type=bind,source=${path.source},target=${path.target},readonly`]),
      '--entrypoint', args[0], imageId, ...args.slice(1)], timeoutMs);
  } finally {
    const owned = docker(['ps', '-aq', ...filter, '--filter', `label=${label}`]);
    if (owned) { assert.match(owned, /^[a-f0-9]{12,64}$/); docker(['rm', '--force', owned]); }
    assert.equal(docker(['ps', '-aq', ...filter]), '', 'system_zlib_cleanup_failed');
  }
}

/** Compiler packages are confined to a throwaway build stage; export only its probe. */
export async function withSystemZlibProbe(platform, operation) {
  assert.ok(['linux/amd64', 'linux/arm64'].includes(platform));
  const boundary = resolve(repository, '.tmp'); mkdirSync(boundary, { recursive: true });
  const directory = await mkdtemp(resolve(boundary, 'system-zlib-'));
  const source = await readFile(resolve(repository, 'Dockerfile'), 'utf8');
  const arg = name => { const value = source.match(new RegExp(`^ARG ${name}=(\\S+)$`, 'm'))?.[1]; assert.ok(value); return value; };
  const base = `node:${arg('NODE_VERSION')}-alpine${arg('ALPINE_VERSION')}@${arg('NODE_IMAGE_DIGEST')}`;
  assert.match(base, /^node:24\.\d+\.\d+-alpine\d+\.\d+@sha256:[a-f0-9]{64}$/);
  try {
    docker(['build', '--platform', platform, '--file', resolve(fixture, 'Dockerfile'), '--target', 'artifact',
      '--build-arg', `BASE_IMAGE=${base}`, '--output', `type=local,dest=${directory}`, repository], 300000);
    return await operation(directory);
  } finally {
    assert.ok(directory.startsWith(boundary + sep) && directory !== boundary);
    await rm(directory, { recursive: true, force: true });
  }
}
