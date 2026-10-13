/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareLocalDockerRollback, runWithLocalDockerRollback } from '../../../../scripts/lib/localDockerRollback.mjs';
import { findComposeCommandIndex, resolveLocalDockerRollbackPlan } from '../../../../scripts/lib/localDockerRollbackArgs.mjs';

const CONTAINER = 'a'.repeat(64);
const IMAGE = `sha256:${'b'.repeat(64)}`;
const OTHER = `sha256:${'c'.repeat(64)}`;
const REFERENCE = `classifarr-local-rollback:${CONTAINER}`;
const plan = { composeOptions: ['-f', 'fixture.yml', '-p', 'fixture'], service: 'app', mode: 'build' };

function fixture(overrides = {}) {
  const state = { ids: CONTAINER, image: IMAGE, project: 'fixture', service: 'app',
    status: 'running', oneoff: 'False', reference: null, ...overrides };
  const commandRunner = jest.fn(args => {
    const ok = stdout => ({ status: 0, stdout });
    if (args[0] === 'compose') {
      expect(args.slice(1, 5)).toEqual(plan.composeOptions);
      if (args[5] === 'config') return ok(JSON.stringify({ name: 'fixture', services: { app: {} } }));
      expect(args.slice(5)).toEqual(['ps', '--all', '--quiet', '--no-trunc', '--orphans=false', 'app']);
      return ok(state.ids);
    }
    if (args[0] === 'container') return ok([
      CONTAINER, state.image, state.status, state.project, state.service, state.oneoff,
    ].map(value => JSON.stringify(value)).join('\n'));
    if (args[1] === 'ls') return ok(state.reference ?? '');
    if (args[1] === 'tag') {
      expect(args).toEqual(['image', 'tag', IMAGE, REFERENCE]);
      state.reference = IMAGE;
      return ok('');
    }
    if (args[1] === 'inspect') {
      if (args[2] === REFERENCE) return state.reference ? ok(state.reference) : { status: 1, stderr: 'SECRET', stdout: '' };
      if (args[2] === IMAGE) return ok(state.source ?? IMAGE);
    }
    throw new Error('SECRET unexpected command');
  });
  return { state, commandRunner };
}

describe('local Docker rollback guard', () => {
  test('retains the exact image before build, verifies after it and supports read-only replacement checks', () => {
    const f = fixture();
    const runCompose = jest.fn(() => {
      expect(f.state.reference).toBe(IMAGE);
      return { status: 0 };
    });
    const report = jest.fn();
    expect(runWithLocalDockerRollback({ plan, ...f, runCompose, report })).toEqual({ status: 0 });
    expect(report).toHaveBeenCalledWith({ project: 'fixture', service: 'app', containerId: CONTAINER, imageId: IMAGE, reference: REFERENCE });
    const callsAfterBuild = f.commandRunner.mock.calls.length;
    const up = prepareLocalDockerRollback({ ...plan, mode: 'up', ...f });
    expect(up.evidence.imageId).toBe(IMAGE);
    expect(f.commandRunner.mock.calls.slice(callsAfterBuild).every(([args]) => args[1] !== 'tag')).toBe(true);
    expect(runCompose).toHaveBeenCalledTimes(1);
  });

  test.each(['running', 'exited', 'created'])('protects %s containers idempotently', status => {
    const f = fixture({ status, reference: IMAGE });
    prepareLocalDockerRollback({ ...plan, ...f });
    expect(f.commandRunner.mock.calls.every(([args]) => args[1] !== 'tag')).toBe(true);
  });

  test('fresh install explicitly has no rollback image and never creates a tag', () => {
    const f = fixture({ ids: '' });
    const guard = prepareLocalDockerRollback({ ...plan, ...f });
    expect(guard.evidence).toEqual({ project: 'fixture', service: 'app', containerId: null, imageId: null, reference: null });
    expect(f.commandRunner.mock.calls.every(([args]) => args[0] === 'compose')).toBe(true);
    f.state.ids = CONTAINER;
    expect(guard.verify).toThrow('rollback_container_changed');
  });

  test.each([
    [{ reference: OTHER }, 'rollback_reference_conflict'],
    [{ source: OTHER }, 'rollback_source_image_mismatch'],
    [{ ids: `${CONTAINER}\n${CONTAINER}` }, 'rollback_ambiguous_container'],
    [{ ids: 'short-id' }, 'rollback_ambiguous_container'],
    [{ image: 'mutable:tag' }, 'rollback_container_identity_unverified'],
    [{ project: 'other' }, 'rollback_container_identity_unverified'],
    [{ service: 'other' }, 'rollback_container_identity_unverified'],
    [{ oneoff: 'True' }, 'rollback_container_identity_unverified'],
    [{ status: 'restarting' }, 'rollback_container_identity_unverified'],
    [{ status: 'removing' }, 'rollback_container_identity_unverified'],
  ])('refuses invalid discovery before invoking Compose: %j', (overrides, error) => {
    const f = fixture(overrides);
    const runCompose = jest.fn();
    expect(() => runWithLocalDockerRollback({ plan, ...f, runCompose })).toThrow(error);
    expect(runCompose).not.toHaveBeenCalled();
    expect(f.commandRunner.mock.calls.every(([args]) => args[1] !== 'tag')).toBe(true);
  });

  test('replacement cannot create a missing pre-build reference', () => {
    const f = fixture();
    const runCompose = jest.fn();
    expect(() => runWithLocalDockerRollback({ plan: { ...plan, mode: 'up' }, ...f, runCompose }))
      .toThrow('rollback_docker_command_failed');
    expect(runCompose).not.toHaveBeenCalled();
    expect(f.state.reference).toBeNull();
  });

  test.each(['reference', 'source', 'ids'])('rejects %s drift after a successful build', key => {
    const f = fixture();
    const runCompose = jest.fn(() => {
      f.state[key] = key === 'ids' ? '' : OTHER;
      return { status: 0 };
    });
    expect(() => runWithLocalDockerRollback({ plan, ...f, runCompose })).toThrow(/^rollback_/u);
    expect(runCompose).toHaveBeenCalledTimes(1);
  });

  test('rechecks before invoking Compose, even after reporting evidence', () => {
    const f = fixture();
    const runCompose = jest.fn();
    expect(() => runWithLocalDockerRollback({ plan, ...f, runCompose, report: () => { f.state.ids = ''; } }))
      .toThrow('rollback_container_changed');
    expect(runCompose).not.toHaveBeenCalled();
  });

  test.each([
    { status: 1, stdout: '', stderr: 'SECRET' },
    { status: null, error: new Error('SECRET timeout'), stdout: '' },
    { status: 0, stdout: 'invalid JSON SECRET' },
    { status: 0, stdout: '{}' },
  ])('fails closed without disclosing raw metadata/errors: %j', result => {
    const commandRunner = () => result;
    expect(() => prepareLocalDockerRollback({ ...plan, commandRunner })).toThrow(/^rollback_/u);
    expect(() => prepareLocalDockerRollback({ ...plan, commandRunner })).not.toThrow(/SECRET/u);
  });

  test('retains references on build failure and returns the original failure', () => {
    const f = fixture();
    const result = { status: 17 };
    expect(runWithLocalDockerRollback({ plan, ...f, runCompose: () => result })).toBe(result);
    expect(f.state.reference).toBe(IMAGE);
    expect(f.commandRunner.mock.calls.some(([args]) => ['rm', 'prune', 'commit', 'push'].includes(args[1]))).toBe(false);
  });

  test.each(['config', 'ps', 'container', 'source', 'ls', 'tag', 'reference'])('refuses a Docker failure at %s', stage => {
    const f = fixture();
    const runCompose = jest.fn();
    const commandRunner = (args, env) => {
      const failed = (stage === 'config' && args[5] === 'config') ||
        (stage === 'ps' && args[5] === 'ps') || (stage === 'container' && args[0] === 'container') ||
        (stage === 'source' && args[1] === 'inspect' && args[2] === IMAGE) ||
        (stage === 'reference' && args[1] === 'inspect' && args[2] === REFERENCE) ||
        (['ls', 'tag'].includes(stage) && args[1] === stage);
      return failed ? { status: 1, stdout: '', stderr: 'SECRET' } : f.commandRunner(args, env);
    };
    expect(() => runWithLocalDockerRollback({ plan, commandRunner, runCompose })).toThrow('rollback_docker_command_failed');
    expect(runCompose).not.toHaveBeenCalled();
  });

  test('rejects truncated or malformed container metadata', () => {
    const f = fixture();
    const commandRunner = (args, env) => args[0] === 'container'
      ? { status: 0, stdout: 'SECRET malformed' } : f.commandRunner(args, env);
    expect(() => prepareLocalDockerRollback({ ...plan, commandRunner })).toThrow('rollback_invalid_metadata');
  });

  test('does not mistake a throwing runner for missing metadata', () => {
    expect(() => prepareLocalDockerRollback({ ...plan, commandRunner: () => { throw new Error('SECRET'); } }))
      .toThrow('rollback_docker_command_failed');
  });

  test.each([{ service: '--all' }, { mode: 'down' }])('rejects invalid direct invocation %j', overrides => {
    const commandRunner = jest.fn();
    expect(() => prepareLocalDockerRollback({ ...plan, ...overrides, commandRunner })).toThrow('rollback_invalid_scope');
    expect(commandRunner).not.toHaveBeenCalled();
  });
});

describe('protected Compose command contract', () => {
  const commands = new Set(['build', 'up', 'down']);
  test('skips option values named like commands', () => {
    const args = ['-p', 'build', '-f', 'up', 'build', '--no-cache', 'app'];
    expect(findComposeCommandIndex(args, commands)).toBe(4);
    expect(resolveLocalDockerRollbackPlan(args, 4)).toEqual({ composeOptions: args.slice(0, 4), mode: 'build', service: 'app' });
  });
  test.each(['--pull=never', '--pull never'])('accepts scoped replacement with %s', pull => {
    const args = ['up', '-d', '--no-build', '--no-deps', ...pull.split(' '), '--force-recreate', '--wait', 'app'];
    expect(resolveLocalDockerRollbackPlan(args, 0)).toEqual({ composeOptions: [], service: 'app', mode: 'up' });
  });
  test.each([
    ['build'], ['build', 'app', 'other'], ['up', '--build', 'app'], ['down', 'app'],
    ['up', '--no-build', '--no-deps', 'app'], ['up', '--no-build', '--pull=never', 'app'],
    ['up', '--no-build', '--no-deps', '--pull=always', 'app'],
    ['up', '--no-build', '--no-deps', '--pull=never', '--remove-orphans', 'app'],
    ['build', '--with-dependencies', 'app'], ['build', '--push', 'app'],
  ])('rejects unsupported or broad commands %j', (...args) => {
    expect(() => resolveLocalDockerRollbackPlan(args, 0)).toThrow(/^rollback_/u);
  });
  test('rebuild aliases protect both steps and never stop before building', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'));
    for (const name of ['docker:smart:rebuild', 'docker:smart:provenance-rebuild']) {
      const steps = pkg.scripts[name].split(' && ');
      expect(steps).toHaveLength(2);
      for (const step of steps) expect(step).toContain('--protect-running-image classifarr');
      expect(steps[0]).toContain(' build ');
      expect(steps[1]).toContain('--no-build --no-deps --pull never');
      expect(pkg.scripts[name]).not.toContain('down');
    }
  });
  test('only accepts known global options on the protected path', () => {
    expect(resolveLocalDockerRollbackPlan(['--project-name=fixture', 'build', 'app'], 1).composeOptions)
      .toEqual(['--project-name=fixture']);
    expect(() => resolveLocalDockerRollbackPlan(['--unknown', 'build', 'app'], 1))
      .toThrow('rollback_unsupported_compose_option');
  });
  test('CLI rejects an unsupported protected command with nonzero exit', () => {
    const script = fileURLToPath(new URL('../../../../scripts/docker-compose-smart.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script, 'down', '--protect-running-image', 'app'], { encoding: 'utf8', timeout: 5000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('rollback_requires_build_or_up');
  });
  test('dry-run validates arguments but needs no working Docker daemon', () => {
    const script = fileURLToPath(new URL('../../../../scripts/docker-compose-smart.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script, '-f', 'does-not-exist.yml', 'build', '--protect-running-image', '--dry-run', 'app'], {
      encoding: 'utf8', timeout: 15000, env: { ...process.env, DOCKER_HOST: 'tcp://127.0.0.1:1' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Verified rollback');
  });
});
