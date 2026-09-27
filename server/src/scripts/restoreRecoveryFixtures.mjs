/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

export function assertDrillEnvironment(env = process.env) {
  if (env.CLASSIFARR_RESTORE_DRILL !== 'isolated-compose-v1' ||
      env.POSTGRES_HOST !== 'database' || env.POSTGRES_DB !== 'classifarr_restore_drill' ||
      env.POSTGRES_USER !== 'rehearsal' || env.POSTGRES_PORT !== '5432' ||
      env.BACKUP_DIR !== '/app/data/backups' || env.MIGRATIONS_DIR !== '/app/database/migrations' ||
      !/^[a-f0-9]{64}$/.test(env.POSTGRES_PASSWORD ?? '')) {
    throw new Error('isolated_drill_environment_required');
  }
}

export async function seedRecoveryFixtures(db) {
  const target = (await db.query(`SELECT current_database() AS name,
    EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public') AS occupied`)).rows[0];
  if (target.name !== 'classifarr_restore_drill' || target.occupied) throw new Error('empty_drill_database_required');
  await db.query(await readFile('/app/database/schema/current.sql', 'utf8'));
  const { createMigrationRunner } = await import('../config/migrations.mjs');
  await createMigrationRunner({ dbClient: db, env: { MIGRATIONS_DIR: '/app/database/migrations' } }).run();
  const { hashPassword } = await import('../services/auth.mjs');
  const password = `Drill-${randomBytes(32).toString('hex')}!`;
  await db.query(`INSERT INTO users (username, password_hash, role) VALUES ('restore-drill-admin', $1, 'admin')`,
    [await hashPassword(password)]);
  await db.query(`INSERT INTO confidence_settings (setting_key, setting_value)
    VALUES ('restore_drill_probe', 'backup-value')`);
  await db.query("INSERT INTO settings (key, value) VALUES ('restore_drill_probe', 'backup-value')");
  await db.query(`INSERT INTO libraries (external_id, name, media_type, is_active) VALUES
    ('restore-drill-movie', 'Synthetic Movie Library', 'movie', false),
    ('restore-drill-tv', 'Synthetic TV Library', 'tv', false)`);
  const { backupService } = await import('../services/backupService.mjs');
  const backup = await backupService.createBackup({ encrypted: false });
  await db.query("UPDATE confidence_settings SET setting_value = 'before-restore' WHERE setting_key = 'restore_drill_probe'");
  await db.query("UPDATE settings SET value = 'before-restore' WHERE key = 'restore_drill_probe'");
  await db.query("UPDATE libraries SET name = 'Before restore' WHERE external_id IN ('restore-drill-movie', 'restore-drill-tv')");
  return { password, filename: backup.filename };
}

export async function readRecoveryState(db) {
  const result = await db.query(`SELECT
    (SELECT setting_value FROM confidence_settings WHERE setting_key = 'restore_drill_probe') AS probe,
    (SELECT value FROM settings WHERE key = 'restore_drill_probe') AS late_probe,
    (SELECT count(*)::integer FROM policy_backup_restore_verifications) AS receipts,
    (SELECT jsonb_agg(jsonb_build_object('type', media_type, 'name', name) ORDER BY media_type)
      FROM libraries WHERE external_id IN ('restore-drill-movie', 'restore-drill-tv')) AS libraries,
    gate_state, reason_id, verified_at
    FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1`);
  return result.rows[0];
}
