/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { provisionEmbeddedApplicationLayout } from '../../bootstrap/embeddedApplicationLayout.mjs';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { MIGRATION_ROOT } from './identityMigrationDatabase.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assertContainerLayout(await fs.readFile('/proc/self/mountinfo', 'utf8'), await fs.readdir('/sys/class/net'));
assert.deepEqual(process.argv.slice(2), ['--interrupt']);
await withEmbeddedMigrationJournal(MIGRATION_ROOT, () => provisionEmbeddedApplicationLayout({ io: {
  ...fs, open: async (path, flags) => {
    // Production still opens its own exact fixed path with no-follow flags.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- delegates only provisioner's fixed allowlist inside disposable fixture
    const file = await fs.open(path, flags);
    if (path === '/app/data/backups') {
      const chmod = file.chmod.bind(file);
      file.chmod = async mode => {
        await chmod(mode);
        process.stdout.write('application-layout-interrupt-ready\n');
        await new Promise(resolve => { setTimeout(resolve, 30_000); });
      };
    }
    return file;
  },
} }));
throw new Error('expected_provisioning_interruption');
