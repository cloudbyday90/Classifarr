/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawnSync } from 'node:child_process';

const IMAGE_ID = /^sha256:[a-f0-9]{64}$/u;
const CONTAINER_ID = /^[a-f0-9]{64}$/u;
const NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/u;
const CONTAINER_FORMAT = [
  '.Id', '.Image', '.State.Status',
  '(index .Config.Labels "com.docker.compose.project")',
  '(index .Config.Labels "com.docker.compose.service")',
  '(index .Config.Labels "com.docker.compose.oneoff")',
].map(field => `{{json ${field}}}`).join('\n');

function systemCommand(args, env) {
  return spawnSync('docker', args, {
    encoding: 'utf8', shell: false, windowsHide: true, env,
    timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Retains only an image reference. Never reads/writes application data. */
export function prepareLocalDockerRollback({
  composeOptions = [], service, mode, env = process.env,
  commandRunner = systemCommand,
}) {
  if (!NAME.test(service ?? '') || !['build', 'up'].includes(mode)) {
    throw new Error('rollback_invalid_scope');
  }
  function run(args) {
    let result;
    try { result = commandRunner(args, env); }
    catch { throw new Error('rollback_docker_command_failed'); }
    if (result?.error || result?.status !== 0 || typeof result.stdout !== 'string') {
      // Docker errors/configuration can contain private paths and environment values.
      throw new Error('rollback_docker_command_failed');
    }
    return result.stdout.trim();
  }
  function json(text) {
    try { return JSON.parse(text); }
    catch { throw new Error('rollback_invalid_metadata'); }
  }
  const compose = args => run(['compose', ...composeOptions, ...args]);
  function discover() {
    const model = json(compose(['config', '--format', 'json']));
    const project = model?.name;
    if (!NAME.test(project ?? '') || !Object.hasOwn(model?.services ?? {}, service)) {
      throw new Error('rollback_unknown_project_or_service');
    }
    const output = compose(['ps', '--all', '--quiet', '--no-trunc', '--orphans=false', service]);
    const ids = output ? output.split(/\s+/u) : [];
    if (ids.length > 1 || ids.some(id => !CONTAINER_ID.test(id))) {
      throw new Error('rollback_ambiguous_container');
    }
    if (!ids.length) return { project, service, containerId: null, imageId: null };
    const fields = run(['container', 'inspect', ids[0], '--format', CONTAINER_FORMAT])
      .split(/\r?\n/u).map(json);
    const [containerId, imageId, state, containerProject, containerService, oneoff] = fields;
    if (fields.length !== 6 || containerId !== ids[0] || !IMAGE_ID.test(imageId) ||
      containerProject !== project || containerService !== service ||
      String(oneoff).toLowerCase() !== 'false' || !['running', 'exited', 'created'].includes(state)) {
      throw new Error('rollback_container_identity_unverified');
    }
    return { project, service, containerId, imageId };
  }
  const subject = discover();
  const reference = subject.containerId ? `classifarr-local-rollback:${subject.containerId}` : null;
  const imageId = referenceOrId => run(['image', 'inspect', referenceOrId, '--format', '{{.Id}}']);
  function verify() {
    if (JSON.stringify(discover()) !== JSON.stringify(subject)) {
      throw new Error('rollback_container_changed');
    }
    if (reference && (imageId(reference) !== subject.imageId || imageId(subject.imageId) !== subject.imageId)) {
      throw new Error('rollback_image_mismatch');
    }
    return { ...subject, reference };
  }
  if (reference && mode === 'build') {
    if (imageId(subject.imageId) !== subject.imageId) throw new Error('rollback_source_image_mismatch');
    const existing = run(['image', 'ls', '--all', '--quiet', '--no-trunc', '--filter', `reference=${reference}`]);
    if (existing) {
      if (existing !== subject.imageId || imageId(reference) !== subject.imageId) {
        throw new Error('rollback_reference_conflict');
      }
    } else {
      run(['image', 'tag', subject.imageId, reference]);
    }
  }
  // Up only verifies; it cannot manufacture a missing pre-build reference.
  const evidence = Object.freeze(verify());
  return { evidence, verify };
}

export function runWithLocalDockerRollback({ plan, env, commandRunner, runCompose, report = () => {} }) {
  const guard = prepareLocalDockerRollback({ ...plan, env, commandRunner });
  report(guard.evidence);
  guard.verify();
  const result = runCompose();
  if (plan.mode === 'build' && result?.status === 0 && !result.error) guard.verify();
  return result;
}
