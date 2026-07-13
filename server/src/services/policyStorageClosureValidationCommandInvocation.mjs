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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const NPM_COMMANDS = new Set(['npm', 'npx']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getNpmCliFilename(command = '') {
  return command === 'npx' ? 'npx-cli.js' : 'npm-cli.js';
}

function getNpmCliPath({
  command = '',
  npmExecPath = '',
  nodeExecPath = process.execPath,
  fileExists = fs.existsSync,
} = {}) {
  if (!NPM_COMMANDS.has(command)) {
    return null;
  }

  if (npmExecPath) {
    if (command === 'npm') {
      return npmExecPath;
    }

    const npxCliPath = path.join(path.dirname(npmExecPath), getNpmCliFilename(command));
    return fileExists(npxCliPath) ? npxCliPath : null;
  }

  const bundledCliPath = path.join(
    path.dirname(nodeExecPath),
    'node_modules',
    'npm',
    'bin',
    getNpmCliFilename(command)
  );

  return fileExists(bundledCliPath) ? bundledCliPath : null;
}

function buildPolicyStorageClosureValidationCommandInvocation({
  commandSpec = {},
  nodeExecPath = process.execPath,
  npmExecPath = process.env.npm_execpath || '',
  fileExists = fs.existsSync,
} = {}) {
  const command = String(commandSpec.command || '');
  const args = asArray(commandSpec.args);

  if (command === 'node') {
    return {
      command: nodeExecPath,
      args,
    };
  }

  const npmCliPath = getNpmCliPath({
    command,
    npmExecPath,
    nodeExecPath,
    fileExists,
  });

  if (npmCliPath) {
    return {
      command: nodeExecPath,
      args: [npmCliPath, ...args],
    };
  }

  return {
    command,
    args,
  };
}

export {
  buildPolicyStorageClosureValidationCommandInvocation,
  getNpmCliPath,
};
