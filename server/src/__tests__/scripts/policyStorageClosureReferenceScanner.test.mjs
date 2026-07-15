import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  scanPolicyStorageClosureReferences,
} from '../../../../scripts/lib/policyStorageClosureReferenceScanner.mjs';

function writeFixture(rootPath, repositoryPath, content) {
  const filePath = path.join(rootPath, repositoryPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('policyStorageClosureReferenceScanner', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-storage-closure-'));
    [
      'client/src',
      'server/src',
      'scripts',
      'database/migrations',
    ].forEach(repositoryPath => {
      fs.mkdirSync(path.join(fixtureRoot, repositoryPath), { recursive: true });
    });
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('reports product references while excluding only self references and explicit control-plane evidence', () => {
    const manifestPath = 'server/src/services/retiredCompatibilityService.mjs';

    writeFixture(fixtureRoot, manifestPath, `export const retiredPath = '${manifestPath}';\n`);
    writeFixture(
      fixtureRoot,
      'server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs',
      `export const manifestEvidence = '${manifestPath}';\n`
    );
    writeFixture(
      fixtureRoot,
      'server/src/__tests__/services/retiredCompatibilityService.test.mjs',
      `const removedPath = '${manifestPath}';\n`
    );
    writeFixture(
      fixtureRoot,
      'server/src/routes/policyRuntimeRoute.mjs',
      `import '${manifestPath}';\n`
    );

    const scan = scanPolicyStorageClosureReferences({
      cwd: fixtureRoot,
      manifestPaths: [manifestPath],
    });

    expect(scan).toEqual({
      completed: true,
      checkedPaths: [manifestPath],
      references: [{
        path: manifestPath,
        referencedBy: 'server/src/routes/policyRuntimeRoute.mjs',
        line: 1,
      }],
    });
  });

  test('does not hide a service reference merely because it lives beside retired artifacts', () => {
    const manifestPath = 'server/src/services/retiredCompatibilityService.mjs';

    writeFixture(
      fixtureRoot,
      'server/src/services/currentCompatibilityVerifier.mjs',
      `export const retiredPath = '${manifestPath}';\n`
    );

    const scan = scanPolicyStorageClosureReferences({
      cwd: fixtureRoot,
      manifestPaths: [manifestPath],
    });

    expect(scan.references).toEqual([{
      path: manifestPath,
      referencedBy: 'server/src/services/currentCompatibilityVerifier.mjs',
      line: 1,
    }]);
  });

  test('ignores manifest literals in named control-plane evidence but not imports', () => {
    const manifestPath = 'server/src/services/retiredCompatibilityService.mjs';

    writeFixture(
      fixtureRoot,
      'server/src/services/policyCompatibilityDeletionGates.mjs',
      [
        `export const removedPath = '${manifestPath}';`,
        "import './retiredCompatibilityService.mjs';",
      ].join('\n')
    );

    const scan = scanPolicyStorageClosureReferences({
      cwd: fixtureRoot,
      manifestPaths: [manifestPath],
    });

    expect(scan.references).toEqual([{
      path: manifestPath,
      referencedBy: 'server/src/services/policyCompatibilityDeletionGates.mjs',
      line: 2,
    }]);
  });

  test('marks the scan incomplete when a configured scan root is unavailable', () => {
    const scan = scanPolicyStorageClosureReferences({
      cwd: fixtureRoot,
      manifestPaths: ['server/src/services/retiredCompatibilityService.mjs'],
      scanRoots: ['server/src', 'missing/root'],
    });

    expect(scan).toEqual(expect.objectContaining({
      completed: false,
      checkedPaths: ['server/src/services/retiredCompatibilityService.mjs'],
      references: [],
      scanIssues: [{
        issueId: 'scan_root_missing',
        repositoryPath: 'missing/root',
      }],
    }));
  });
});
