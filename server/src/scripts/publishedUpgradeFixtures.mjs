/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const fixturePath = '/app/data/upgrade-drill/fixture.json';
export function assertUpgradeDrillEnvironment(env = process.env) {
  assert.equal(env.CLASSIFARR_UPGRADE_DRILL, 'isolated-compose-v1');
  for (const [key, value] of Object.entries({ POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432',
    POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr', BACKUP_DIR: '/app/data/backups',
    MIGRATIONS_DIR: '/app/database/migrations' })) assert.equal(env[key], value);
}
export async function readUpgradeFixture() {
  assertUpgradeDrillEnvironment();
  return JSON.parse(await readFile(fixturePath, 'utf8'));
}
export async function writeUpgradeFixture(fixture) {
  assertUpgradeDrillEnvironment();
  await mkdir('/app/data/upgrade-drill', { recursive: true, mode: 0o700 });
  await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
}
export async function databaseVersion(db) {
  return (await db.query(`SELECT current_setting('server_version_num') AS version,
    (SELECT count(*)::integer FROM schema_migrations) AS migrations`)).rows[0];
}

// This module is streamed into the released container. It deliberately imports
// that image's own database, password hasher and backup exporter, not ours.
export async function seedPublishedFixtures() {
  assertUpgradeDrillEnvironment();
  // Fixed in-image paths are intentional: this helper runs against the published
  // image's modules when streamed through stdin, not this checkout.
  // eslint-disable-next-line n/no-missing-import, n/no-unpublished-import
  const db = await import('/app/src/config/database.mjs');
  try {
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM users')).rows[0].count, 0);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM libraries')).rows[0].count, 0);
    // eslint-disable-next-line n/no-missing-import, n/no-unpublished-import
    const { hashPassword } = await import('/app/src/services/auth.mjs');
    const password = `Drill-${randomBytes(32).toString('hex')}!`;
    await db.query(`INSERT INTO users (username,password_hash,role) VALUES ('restore-drill-admin',$1,'admin')`,
      [await hashPassword(password)]);
    await db.query("INSERT INTO confidence_settings (setting_key,setting_value) VALUES ('restore_drill_probe','backup-value')");
    await db.query("INSERT INTO settings (key,value) VALUES ('restore_drill_probe','backup-value')");
    await db.query(`INSERT INTO libraries (external_id,name,media_type,is_active) VALUES
      ('restore-drill-movie','Synthetic Movie Library','movie',false),
      ('restore-drill-tv','Synthetic TV Library','tv',false)`);
    // eslint-disable-next-line n/no-missing-import, n/no-unpublished-import
    const { backupService } = await import('/app/src/services/backupService.mjs');
    const backup = await backupService.createBackup({ encrypted: false });
    await db.query("UPDATE confidence_settings SET setting_value='before-restore' WHERE setting_key='restore_drill_probe'");
    await db.query("UPDATE settings SET value='before-restore' WHERE key='restore_drill_probe'");
    await db.query("UPDATE libraries SET name='Before restore' WHERE external_id IN ('restore-drill-movie','restore-drill-tv')");
    const baseline = await databaseVersion(db);
    await writeUpgradeFixture({ password, filename: backup.filename, baseline });
    return baseline;
  } finally { await db.pool.end(); }
}
