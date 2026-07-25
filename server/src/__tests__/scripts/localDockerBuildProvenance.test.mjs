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

import { jest } from '@jest/globals';

import {
  LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS,
  resolveVerifiedLocalDockerBuildProvenance,
} from '../../../../scripts/lib/localDockerBuildProvenance.mjs';

const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const WORKSPACE_ROOT = 'C:\\workspace\\classifarr';

function createCommandRunner({
  revision = SOURCE_REVISION,
  statusExitCode = 0,
  worktreeStatus = '',
  workspaceRoot = WORKSPACE_ROOT,
} = {}) {
  return jest.fn(({ command, args }) => {
    if (command !== 'git') {
      return { status: 1, stdout: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
      return { status: 0, stdout: `${workspaceRoot}\n` };
    }
    if (args[0] === 'status') {
      return { status: statusExitCode, stdout: worktreeStatus };
    }
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
      return { status: 0, stdout: `${revision}\n` };
    }

    return { status: 1, stdout: '' };
  });
}

describe('localDockerBuildProvenance', () => {
  test('returns the exact revision only for a clean checkout', () => {
    const commandRunner = createCommandRunner();

    const outcome = resolveVerifiedLocalDockerBuildProvenance({
      commandRunner,
      cwd: 'C:\\workspace\\classifarr',
    });

    expect(outcome).toEqual({
      message: 'The local source checkout is clean and revision-verified.',
      revision: SOURCE_REVISION,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.VERIFIED,
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(commandRunner).toHaveBeenCalledWith({
      args: ['status', '--porcelain=v1', '--untracked-files=all'],
      command: 'git',
      cwd: WORKSPACE_ROOT,
    });
  });

  test('does not resolve a revision from a dirty checkout', () => {
    const commandRunner = createCommandRunner({
      worktreeStatus: ' M server/src/index.mjs\n',
    });

    const outcome = resolveVerifiedLocalDockerBuildProvenance({ commandRunner });

    expect(outcome).toEqual(expect.objectContaining({
      revision: null,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.DIRTY_CHECKOUT,
    }));
    expect(commandRunner).not.toHaveBeenCalledWith(expect.objectContaining({
      args: ['rev-parse', 'HEAD'],
    }));
  });

  test('fails closed when Git cannot verify the worktree', () => {
    const commandRunner = createCommandRunner({ statusExitCode: 1 });

    const outcome = resolveVerifiedLocalDockerBuildProvenance({ commandRunner });

    expect(outcome).toEqual(expect.objectContaining({
      revision: null,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.UNAVAILABLE,
    }));
  });

  test('rejects a non-immutable revision', () => {
    const commandRunner = createCommandRunner({ revision: 'main' });

    const outcome = resolveVerifiedLocalDockerBuildProvenance({ commandRunner });

    expect(outcome).toEqual(expect.objectContaining({
      revision: null,
      statusId: LOCAL_DOCKER_BUILD_PROVENANCE_STATUS_IDS.UNAVAILABLE,
    }));
  });
});
