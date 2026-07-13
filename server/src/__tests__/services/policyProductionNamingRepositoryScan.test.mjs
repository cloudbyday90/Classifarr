import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPolicyProductionNamingRepositoryInventory,
} from '../../../../scripts/lib/policyProductionNamingRepositoryScan.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

describe('policyProductionNamingRepositoryScan', () => {
  test('builds a valid current repository inventory without mutation', () => {
    const inventory = buildPolicyProductionNamingRepositoryInventory({
      rootDir: repositoryRoot,
      generatedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(inventory.scanScope).toBe('repository');
    expect(inventory.validation.ok).toBe(true);
    expect(inventory.sideEffects).toEqual({
      filesRead: true,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    });
  });
});
