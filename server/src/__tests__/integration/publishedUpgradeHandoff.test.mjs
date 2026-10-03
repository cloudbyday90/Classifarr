/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';
import { resourceAdmissionFixture } from '../helpers/resourceAdmissionFixture.mjs';

// Only this host-run integration fixture controls memory telemetry. The unchanged
// standalone image probe still observes its real container resource limits.
jest.unstable_mockModule('../../services/backgroundResourceAdmission.mjs', () => ({
  createBackgroundResourceAdmission,
  backgroundResourceAdmission: resourceAdmissionFixture(),
}));

const { runUpgradeHandoff } = await import('../../scripts/publishedUpgradeHandoff.mjs');
const db = createIntegrationDatabaseModuleMock();

test('the published-upgrade synthetic recovery probe respects durable handoff source admission', async () => {
  const guard = { CLASSIFARR_UPGRADE_DRILL: 'isolated-compose-v1', POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432',
    POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr', BACKUP_DIR: '/app/data/backups', MIGRATIONS_DIR: '/app/database/migrations' };
  const previous = Object.fromEntries(Object.keys(guard).map(key => [key, process.env[key]]));
  Object.assign(process.env, guard);
  try {
    await db.query(`INSERT INTO libraries(external_id,name,media_type,is_active) VALUES
      ('restore-drill-movie','Synthetic Movie Library','movie',false),
      ('restore-drill-tv','Synthetic TV Library','tv',false)`);
    expect(await runUpgradeHandoff(db)).toEqual({ movie: 'current', tv: 'current', music: 'excluded', routingTasks: 0 });
    expect((await db.query("SELECT is_active FROM media_server WHERE name='Synthetic upgrade'")).rows)
      .toEqual([{ is_active: false }]);
    expect((await db.query("SELECT is_active FROM tmdb_config WHERE api_key='synthetic-only'")).rows)
      .toEqual([{ is_active: false }]);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
