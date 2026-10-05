/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile, symlink } from 'node:fs/promises';
import { assertContainerLayout } from './contract.mjs';
import { selectedApplicationEnvironment } from '../../bootstrap/embeddedSelectedApplication.mjs';
import { runSelectedApplication } from '../runSelectedApplication.mjs';

assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 1000);
assert.equal(process.env.CLASSIFARR_EMBEDDED_ISOLATION_DRILL, 'disposable-v1');
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
assert.equal(process.argv.length, 2);
const root = '/app/data/config/selected-invalid';
await mkdir(root, { mode: 0o700 }); // Refuse an existing fixture; never overwrite installation data.
const key = (await readFile('/app/data/secrets/api_key_encryption_key', 'utf8')).trim();
await writeFile(`${root}/malformed-key`, 'invalid-synthetic-key', { flag: 'wx', mode: 0o600 });
await writeFile(`${root}/public-key`, key, { flag: 'wx', mode: 0o644 });
await writeFile(`${root}/oversized-key`, 'a'.repeat(129), { flag: 'wx', mode: 0o600 });
await writeFile(`${root}/malformed.json`, '{invalid-fixture', { flag: 'wx', mode: 0o600 });
await symlink('/app/data/secrets/api_key_encryption_key', `${root}/linked-key`);

for (const configuration of [
  ...['malformed-key', 'public-key', 'oversized-key', 'linked-key', 'missing-key'].map(name => ({ API_KEY_ENCRYPTION_KEY_FILE: `${root}/${name}` })),
  ...['malformed.json', 'missing.json'].map(name => ({ API_KEY_ENCRYPTION_KEY: key, RUNTIME_SETTINGS_FILE: `${root}/${name}` })),
]) {
  let imported = false;
  await assert.rejects(runSelectedApplication({
    environment: selectedApplicationEnvironment({ ...configuration, LOG_LEVEL: 'error', FILE_LOGGING_ENABLED: 'false' }),
    context: { uid: process.getuid(), gid: process.getgid(), platform: process.platform, cwd: process.cwd(), args: ['--run'] },
    onAdmissionLost: () => {},
    loadDatabase: async () => { imported = true; throw new Error('must_not_import_database'); },
    loadApplication: async () => { imported = true; throw new Error('must_not_import_application'); },
  }), error => error.message === 'selected_application_configuration_unavailable');
  assert.equal(imported, false, 'invalid_configuration_imported_services');
}
assert.equal(await readFile(`${root}/malformed-key`, 'utf8'), 'invalid-synthetic-key');
assert.equal(await readFile(`${root}/malformed.json`, 'utf8'), '{invalid-fixture');
assert.equal((await readFile('/app/data/secrets/api_key_encryption_key', 'utf8')).trim(), key);
await assert.rejects(readFile(`${root}/missing-key`), error => error.code === 'ENOENT');
await assert.rejects(readFile(`${root}/missing.json`), error => error.code === 'ENOENT');
process.stdout.write('PASS invalid_selected_configuration_refused_before_imports_without_regeneration\n');
