/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { healthConfigurationQuery } from '../../services/healthConfigurationQueries.mjs';
import { createHealthObservationCoordinator } from '../../services/healthObservationCoordinator.mjs';
import { readHealthConfiguration } from '../../services/healthConfigurationRead.mjs';

// Names/columns below are fixed fixtures, never caller input. The runner creates
// a disposable suite database; copies retain actual migrated column definitions.
const arr = { id: 2, name: 'new name', url: 'http://new.invalid', protocol: 'https',
    host: 'new.invalid', port: 9000, base_path: '/new', api_key: 'new fixture key', verify_ssl: false, timeout: 8 };
const credentials = { id: 2, api_key: 'new fixture key', credential_generation: '12345678-1234-4567-8123-123456789abc',
    credential_rejected_at: '2026-10-12T12:00:00Z' };
const definitions = [
    { service: 'radarr', table: 'radarr_config', changes: arr,
        insert: "INSERT INTO health_dependencies.radarr_config (id,name,url,api_key) VALUES (1,'fixture','http://old.invalid','fixture key')",
        incidental: 'UPDATE health_dependencies.radarr_config SET updated_at=NOW(),quality_profile_id=9,minimum_availability=\'announced\'' },
    { service: 'sonarr', table: 'sonarr_config', changes: arr,
        insert: "INSERT INTO health_dependencies.sonarr_config (id,name,url,api_key) VALUES (1,'fixture','http://old.invalid','fixture key')",
        incidental: "UPDATE health_dependencies.sonarr_config SET updated_at=NOW(),quality_profile_id=9,monitor='none',series_type='anime'" },
    { service: 'tmdb', table: 'tmdb_config', changes: { id: 2, api_key: 'new fixture key' },
        insert: "INSERT INTO health_dependencies.tmdb_config (id,api_key) VALUES (1,'fixture key')",
        incidental: "UPDATE health_dependencies.tmdb_config SET updated_at=NOW(),language='fr-FR'" },
    { service: 'omdb', table: 'omdb_config', changes: credentials,
        insert: "INSERT INTO health_dependencies.omdb_config (id,api_key) VALUES (1,'fixture key')",
        incidental: "UPDATE health_dependencies.omdb_config SET updated_at=NOW(),requests_today=123,daily_limit=2000,last_reset_date='2026-10-10'" },
    { service: 'tavily', table: 'tavily_config', changes: credentials,
        insert: "INSERT INTO health_dependencies.tavily_config (id,api_key) VALUES (1,'fixture key')",
        incidental: "UPDATE health_dependencies.tavily_config SET updated_at=NOW(),search_depth='advanced',max_results=7,include_domains=ARRAY['fixture.invalid']" },
    { service: 'imageEmbeddings', table: 'ai_provider_config', changes: {
        rag_image_weight: 0.5, image_embedding_provider_mode: 'cloud', image_embedding_local_host: 'new.invalid',
        image_embedding_local_port: 9000, image_embedding_cloud_provider: 'fixture', image_embedding_cloud_api_key: 'fixture key',
    }, insert: 'INSERT INTO health_dependencies.ai_provider_config (id) VALUES (1)',
    incidental: 'UPDATE health_dependencies.ai_provider_config SET image_embedding_models_cache_updated_at=NOW(),updated_at=NOW()' },
];

beforeAll(async () => {
    await getPool().query('CREATE SCHEMA health_dependencies');
    for (const { table } of definitions) {
        await getPool().query(`CREATE TABLE health_dependencies.${table} (LIKE public.${table} INCLUDING DEFAULTS)`);
    }
});
beforeEach(async () => {
    for (const definition of definitions) {
        await getPool().query(`TRUNCATE health_dependencies.${definition.table}`);
        await getPool().query(definition.insert);
    }
});

async function withFixture(service, run) {
    const reader = await getPool().connect(), writer = await getPool().connect();
    const coordinator = createHealthObservationCoordinator();
    let probes = 0;
    try {
        await reader.query('SET search_path TO health_dependencies, public');
        const read = () => reader.query(healthConfigurationQuery(service));
        const compute = async (previous, guard) => {
            const config = await readHealthConfiguration(previous, service, read, guard);
            if (!config.ok) return config.health;
            probes++;
            return { status: 'connected', lastCheck: '2026-10-12T12:00:00.000Z' };
        };
        const accepted = await coordinator.run(service, compute);
        expect(accepted.status).toBe('connected');
        await run({ reader, writer, coordinator, accepted, read });
        expect(probes).toBe(1);
    } finally {
        await writer.query('ROLLBACK');
        await reader.query('RESET search_path');
        reader.release(); writer.release();
    }
}

test.each(definitions)('$service excludes incidental updates from both completion and reconciliation', async definition => {
    await withFixture(definition.service, async ({ writer, coordinator, accepted, read }) => {
        const rows = (await read()).rows;
        expect(Object.keys(rows[0]).sort()).toEqual(Object.keys(definition.changes).sort());
        await writer.query(definition.incidental);
        await coordinator.reconcile();
        expect(coordinator.snapshot()[definition.service]).toBe(accepted);
        let release, started;
        const ready = new Promise(resolve => { started = resolve; });
        const gate = new Promise(resolve => { release = resolve; });
        const pending = coordinator.run(definition.service, async (previous, guard) => {
            await readHealthConfiguration(previous, definition.service, read, guard);
            started(); await gate; return accepted;
        });
        await ready;
        await writer.query(definition.incidental);
        release();
        expect(await pending).toBe(accepted);
    });
});

const fieldCases = definitions.flatMap(definition => Object.entries(definition.changes)
    .map(([field, value]) => ({ ...definition, field, value })));
test.each(fieldCases)('$service still detects committed $field changes, not rollback', async definition => {
    await withFixture(definition.service, async ({ writer, coordinator, accepted }) => {
        const sql = `UPDATE health_dependencies.${definition.table} SET ${definition.field}=$1`;
        await writer.query('BEGIN'); await writer.query(sql, [definition.value]);
        await coordinator.reconcile();
        expect(coordinator.snapshot()[definition.service]).toBe(accepted);
        await writer.query('ROLLBACK');
        await coordinator.reconcile();
        expect(coordinator.snapshot()[definition.service]).toBe(accepted);
        await writer.query(sql, [definition.value]);
        await coordinator.reconcile();
        expect(coordinator.snapshot()[definition.service]).toMatchObject({ status: 'unknown',
            failure: { code: 'configuration_changed' }, lastCheck: accepted.lastCheck });
    });
});

test.each(definitions.filter(({ service }) => service !== 'imageEmbeddings'))('$service retains active membership', async definition => {
    await withFixture(definition.service, async ({ writer, coordinator }) => {
        await writer.query(`UPDATE health_dependencies.${definition.table} SET is_active=false`);
        await coordinator.reconcile();
        expect(coordinator.snapshot()[definition.service].failure.code).toBe('configuration_changed');
    });
});

test.each(['tmdb', 'omdb', 'tavily'])('%s still selects newest active configuration', async service => {
    await withFixture(service, async ({ writer, coordinator, read }) => {
        await writer.query(`INSERT INTO health_dependencies.${service}_config (id,api_key,is_active) VALUES (2,'new fixture',true),(3,'inactive fixture',false)`);
        expect((await read()).rows.map(row => row.id)).toEqual([2]);
        await coordinator.reconcile();
        expect(coordinator.snapshot()[service].failure.code).toBe('configuration_changed');
    });
});
