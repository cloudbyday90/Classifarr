#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { prepareLocalDockerRollback } from './lib/localDockerRollback.mjs';

// Synthetic image metadata fixture only: no application entrypoint, data or provider.
const root = resolve(import.meta.dirname, '../.tmp');
const owner = randomUUID();
const name = `classifarr-rollback-check-${owner}`;
const path = join(root, name);
const image = `${name}:mutable`;
const baseline = `${name}:baseline`;
const composeOptions = ['-p', name, '-f', join(path, 'compose.json')];
const env = { ...process.env, PGVECTOR_BUILD: 'generic' };
let reference;
let containerId;
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', shell: false, windowsHide: true,
    timeout: 60_000, maxBuffer: 1024 * 1024, env });
  if (result.status !== 0 || result.error) throw new Error('rollback_fixture_docker_failed');
  return result.stdout.trim();
}
function cli(args, success) {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, 'docker-compose-smart.mjs'),
    ...composeOptions, ...args, '--protect-running-image', 'app'], {
    encoding: 'utf8', shell: false, windowsHide: true, timeout: 60_000, maxBuffer: 1024 * 1024, env,
  });
  assert.ok(!result.error, 'fixture_cli_did_not_complete');
  assert.equal(result.status === 0, success, 'fixture_cli_exit_mismatch');
}
function ownedImage(tag) {
  assert.equal(docker(['image', 'inspect', tag, '--format', '{{index .Config.Labels "io.classifarr.rollback-fixture"}}']), owner);
}
function writeDockerfile(revision) {
  writeFileSync(join(path, 'Dockerfile'), `FROM scratch\nLABEL io.classifarr.rollback-fixture="${owner}"\nLABEL revision="${revision}"\nCMD ["/synthetic-not-executed"]\n`, { flag: 'w' });
}
function sameContainer() {
  assert.equal(docker(['compose', ...composeOptions, 'ps', '--all', '--quiet', '--no-trunc', 'app']), containerId);
  assert.equal(docker(['container', 'inspect', containerId, '--format', '{{.State.Status}}']), 'created');
}

mkdirSync(root, { recursive: true });
mkdirSync(path); // Exclusive new UUID directory; never accept a caller-supplied path.
try {
  assert.equal(docker(['ps', '-aq', '--filter', `label=io.classifarr.rollback-fixture=${owner}`]), '');
  assert.equal(docker(['image', 'ls', '-aq', '--filter', `reference=${image}`]), '');
  assert.equal(docker(['image', 'ls', '-aq', '--filter', `reference=${baseline}`]), '');
  writeDockerfile('before');
  writeFileSync(join(path, 'compose.json'), JSON.stringify({ services: { app: {
    image, build: { context: path }, network_mode: 'none', mem_limit: '32m', cpus: 0.5,
    pids_limit: 8, read_only: true, cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'],
    labels: { 'io.classifarr.rollback-fixture': owner },
  } } }), { flag: 'wx' });
  cli(['build', '--no-cache'], true); // Explicit first-install path.
  const oldImage = docker(['image', 'inspect', image, '--format', '{{.Id}}']);
  docker(['compose', ...composeOptions, 'create', '--no-build', '--pull', 'never', 'app']);
  containerId = docker(['compose', ...composeOptions, 'ps', '--all', '--quiet', '--no-trunc', 'app']);
  assert.match(containerId, /^[a-f0-9]{64}$/u);
  reference = `classifarr-local-rollback:${containerId}`;
  assert.equal(docker(['image', 'ls', '-aq', '--filter', `reference=${reference}`]), '');
  writeDockerfile('after');
  cli(['build', '--no-cache'], true);
  sameContainer();
  const newImage = docker(['image', 'inspect', image, '--format', '{{.Id}}']);
  assert.notEqual(oldImage, newImage);
  assert.equal(docker(['image', 'inspect', reference, '--format', '{{.Id}}']), oldImage);
  prepareLocalDockerRollback({ composeOptions, service: 'app', mode: 'up', env });
  // Keep a fixture-only hold reference so Docker permits untagging the protected
  // reference while a created container uses it. This is not a product fallback.
  docker(['image', 'tag', oldImage, baseline]);
  ownedImage(reference);
  docker(['image', 'rm', reference]); // Fault only the fixture's retained reference.
  const up = ['up', '-d', '--no-build', '--no-deps', '--pull', 'never', '--force-recreate', '--wait'];
  cli(up, false);
  sameContainer();
  docker(['image', 'tag', newImage, reference]);
  cli(up, false);
  cli(['build', '--no-cache'], false);
  sameContainer();
  assert.equal(docker(['image', 'inspect', reference, '--format', '{{.Id}}']), newImage);
  docker(['image', 'tag', oldImage, reference]);
  writeFileSync(join(path, 'Dockerfile'), 'INVALID_FIXTURE_INSTRUCTION\n');
  cli(['build', '--no-cache'], false);
  sameContainer();
  prepareLocalDockerRollback({ composeOptions, service: 'app', mode: 'up', env });
  console.log(JSON.stringify({ checks: 7, oldImage, newImage, mutableTagChanged: true,
    exactRollbackRetained: true, rejectedMissingReference: true, rejectedWrongReference: true,
    buildFailurePreservedContainer: true, applicationDataWrites: 0, providerCalls: 0 }));
} finally {
  // Resolve and verify exact owned resources even if a create/build timed out.
  const ids = docker(['ps', '-aq', '--no-trunc', '--filter', `label=io.classifarr.rollback-fixture=${owner}`]);
  for (const id of ids.split(/\s+/u).filter(Boolean)) {
    assert.match(id, /^[a-f0-9]{64}$/u);
    assert.equal(docker(['container', 'inspect', id, '--format', '{{index .Config.Labels "io.classifarr.rollback-fixture"}}']), owner);
    docker(['container', 'rm', '-f', id]);
  }
  for (const tag of [reference, image, baseline].filter(Boolean)) {
    if (docker(['image', 'ls', '-aq', '--filter', `reference=${tag}`])) {
      ownedImage(tag);
      docker(['image', 'rm', tag]);
    }
    assert.equal(docker(['image', 'ls', '-aq', '--filter', `reference=${tag}`]), '');
  }
  assert.equal(docker(['ps', '-aq', '--filter', `label=io.classifarr.rollback-fixture=${owner}`]), '');
  assert.equal(dirname(resolve(path)), root);
  assert.equal(basename(path), name);
  rmSync(path, { recursive: true });
  console.log('PASS: owned fixture containers, tags and temporary directory removed; no image pruning.');
}
