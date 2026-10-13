/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const GLOBAL_VALUES = new Set(['-f', '--file', '-p', '--project-name', '--project-directory',
  '--env-file', '--profile', '--parallel', '--progress', '--ansi']);

export function findComposeCommandIndex(args, commands) {
  for (let index = 0; index < args.length; index++) {
    if (GLOBAL_VALUES.has(args[index])) { index++; continue; }
    if (commands.has(args[index])) return index;
  }
  return -1;
}

/** Conservative protected path: do not guess which services an arbitrary CLI affects. */
export function resolveLocalDockerRollbackPlan(args, commandIndex) {
  const mode = args[commandIndex];
  if (!['build', 'up'].includes(mode)) throw new Error('rollback_requires_build_or_up');
  const composeOptions = args.slice(0, commandIndex);
  for (let index = 0; index < composeOptions.length; index++) {
    const option = composeOptions[index];
    if (GLOBAL_VALUES.has(option) && composeOptions[index + 1]) { index++; continue; }
    if ([...GLOBAL_VALUES].some(name => name.startsWith('--') && option.startsWith(`${name}=`) && option.length > name.length + 1)) continue;
    throw new Error('rollback_unsupported_compose_option');
  }
  const options = args.slice(commandIndex + 1);
  const flags = mode === 'build'
    ? new Set(['--no-cache', '--pull', '--quiet'])
    : new Set(['-d', '--detach', '--no-build', '--no-deps', '--force-recreate', '--wait']);
  const services = [];
  let pullNever = false;
  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    if (mode === 'up' && option === '--pull' && options[index + 1] === 'never') {
      pullNever = true; index++; continue;
    }
    if (mode === 'up' && option === '--pull=never') { pullNever = true; continue; }
    if (flags.has(option)) continue;
    if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/u.test(option)) services.push(option);
    else throw new Error('rollback_unsupported_command_option');
  }
  if (services.length !== 1) throw new Error('rollback_requires_one_explicit_service');
  if (mode === 'up' && (!options.includes('--no-build') || !options.includes('--no-deps') || !pullNever)) {
    throw new Error('rollback_up_requires_no_build_no_deps_pull_never');
  }
  return { composeOptions, service: services[0], mode };
}
