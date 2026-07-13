import path from 'node:path';

import {
  buildPolicyStorageClosureValidationCommandInvocation,
  getNpmCliPath,
} from '../../services/policyStorageClosureValidationCommandInvocation.mjs';

describe('policyStorageClosureValidationCommandInvocation', () => {
  test('uses the current Node executable for Node command specifications', () => {
    expect(buildPolicyStorageClosureValidationCommandInvocation({
      commandSpec: { command: 'node', args: ['scripts/check.mjs'] },
      nodeExecPath: '/runtime/node',
    })).toEqual({
      command: '/runtime/node',
      args: ['scripts/check.mjs'],
    });
  });

  test('uses the active npm CLI path when the generator was started by npm', () => {
    const nodeExecPath = path.join('C:', 'runtime', 'node.exe');
    const npmExecPath = path.join('C:', 'runtime', 'npm', 'bin', 'npm-cli.js');
    const npxCliPath = path.join('C:', 'runtime', 'npm', 'bin', 'npx-cli.js');

    expect(buildPolicyStorageClosureValidationCommandInvocation({
      commandSpec: { command: 'npx', args: ['markdownlint-cli2', 'CHANGELOG.md'] },
      nodeExecPath,
      npmExecPath,
      fileExists: filePath => filePath === npxCliPath,
    })).toEqual({
      command: nodeExecPath,
      args: [npxCliPath, 'markdownlint-cli2', 'CHANGELOG.md'],
    });
  });

  test('finds the Node-distribution npm CLI for direct Windows or Node execution', () => {
    const nodeExecPath = path.join('C:', 'Node', 'node.exe');
    const expectedCliPath = path.join(
      'C:',
      'Node',
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    );

    expect(getNpmCliPath({
      command: 'npm',
      nodeExecPath,
      fileExists: filePath => filePath === expectedCliPath,
    })).toBe(expectedCliPath);
  });

  test('keeps a non-npm command as a direct shell-free invocation', () => {
    expect(buildPolicyStorageClosureValidationCommandInvocation({
      commandSpec: { command: 'git', args: ['status', '--short'] },
      nodeExecPath: '/runtime/node',
      fileExists: () => false,
    })).toEqual({
      command: 'git',
      args: ['status', '--short'],
    });
  });
});
