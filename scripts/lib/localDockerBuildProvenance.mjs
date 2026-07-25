/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;

export const LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS = Object.freeze({
  DIRTY_CHECKOUT: 'dirty_checkout',
  UNAVAILABLE: 'unavailable',
  VERIFIED: 'verified',
});

function createSystemCommandRunner() {
  return ({ command, args, cwd }) => spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
}

function runSuccessfulCommand(commandRunner, command, args, cwd) {
  try {
    const result = commandRunner({ command, args, cwd });

    if (result?.status !== 0 || typeof result.stdout !== 'string') {
      return null;
    }

    return result.stdout.trim();
  } catch (_error) {
    return null;
  }
}

/**
 * Resolves only an exact clean-checkout revision. A dirty checkout must never
 * label an image as a committed revision because its contents differ from it.
 */
export function resolveVerifiedLocalDockerBuildProvenance({
  commandRunner = createSystemCommandRunner(),
  cwd = process.cwd(),
} = {}) {
  const workspaceRoot = runSuccessfulCommand(
    commandRunner,
    'git',
    ['rev-parse', '--show-toplevel'],
    cwd
  );

  if (!workspaceRoot) {
    return {
      message: 'Git could not identify the source checkout.',
      revision: null,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.UNAVAILABLE,
      workspaceRoot: null,
    };
  }

  const worktreeStatus = runSuccessfulCommand(
    commandRunner,
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    workspaceRoot
  );

  if (worktreeStatus === null) {
    return {
      message: 'Git could not verify the source checkout state.',
      revision: null,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.UNAVAILABLE,
      workspaceRoot,
    };
  }

  if (worktreeStatus !== '') {
    return {
      message: 'The source checkout contains uncommitted or untracked changes.',
      revision: null,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.DIRTY_CHECKOUT,
      workspaceRoot,
    };
  }

  const revision = runSuccessfulCommand(
    commandRunner,
    'git',
    ['rev-parse', 'HEAD'],
    workspaceRoot
  )?.toLowerCase();

  if (!revision || !REVISION_PATTERN.test(revision)) {
    return {
      message: 'Git did not return a full source revision.',
      revision: null,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.UNAVAILABLE,
      workspaceRoot,
    };
  }

  return {
    message: 'The local source checkout is clean and revision-verified.',
    revision,
    statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.VERIFIED,
    workspaceRoot,
  };
}
