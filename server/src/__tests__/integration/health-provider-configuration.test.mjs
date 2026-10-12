/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { healthConfigurationQuery } from '../../services/healthConfigurationQueries.mjs';
import { createHealthObservationCoordinator } from '../../services/healthObservationCoordinator.mjs';
import { readHealthConfiguration } from '../../services/healthConfigurationRead.mjs';

const tables = ['ai_provider_config', 'ollama_config', 'media_server'];
beforeAll(async () => {
    await getPool().query('CREATE SCHEMA health_provider_fixture');
    for (const table of tables) await getPool().query(`CREATE TABLE health_provider_fixture.${table} (LIKE public.${table} INCLUDING DEFAULTS)`);
});
beforeEach(async () => {
    for (const table of tables) await getPool().query(`TRUNCATE health_provider_fixture.${table}`);
    await getPool().query("INSERT INTO health_provider_fixture.ai_provider_config (id,primary_provider,ollama_host,ollama_port) VALUES (1,'ollama','ai.invalid',1234)");
    await getPool().query("INSERT INTO health_provider_fixture.media_server (id,type,name,url,api_key) VALUES (1,'plex','Fixture','http://fixture.invalid','fixture-key')");
});

async function fixture(service, run) {
    const reader = await getPool().connect(), writer = await getPool().connect();
    const coordinator = createHealthObservationCoordinator();
    let probes = 0;
    try {
        await reader.query('SET search_path TO health_provider_fixture, public');
        const read = () => reader.query(healthConfigurationQuery(service));
        const accepted = await coordinator.run(service, async (previous, guard) => {
            const result = await readHealthConfiguration(previous, service, read, guard);
            expect(result.ok).toBe(true); probes++;
            return { status: 'connected', lastCheck: '2026-10-12T12:00:00.000Z' };
        });
        await run({ reader, writer, read, accepted, coordinator });
        expect(probes).toBe(1);
    } finally {
        await writer.query('ROLLBACK'); await reader.query('RESET search_path');
        reader.release(); writer.release();
    }
}

test.each([
    ['ollama', 'ai_provider_config', 'primary_provider', 'none'],
    ['ollama', 'ai_provider_config', 'ollama_host', 'changed.invalid'],
    ['ollama', 'ai_provider_config', 'ollama_port', 4567],
    ['ollama', 'ai_provider_config', 'api_key', 'changed-fixture'],
    ['ollama', 'ai_provider_config', 'api_endpoint', 'http://changed.invalid'],
    ['ollama', 'ai_provider_config', 'model', 'changed-model'],
    ['mediaServer', 'media_server', 'api_key', 'changed-fixture'],
    ['mediaServer', 'media_server', 'url', 'http://changed.invalid'],
    ['mediaServer', 'media_server', 'type', 'jellyfin'],
    ['mediaServer', 'media_server', 'name', 'Changed'],
    ['mediaServer', 'media_server', 'client_identifier', 'changed-client'],
    ['mediaServer', 'media_server', 'is_active', false],
])('%s detects committed %s.%s changes but not rollback', async (service, table, field, value) => {
    await fixture(service, async ({ writer, coordinator, accepted }) => {
        // Table and column identifiers above are fixed fixtures, never caller data.
        const sql = `UPDATE health_provider_fixture.${table} SET ${field}=$1`;
        await writer.query('BEGIN'); await writer.query(sql, [value]);
        await coordinator.reconcile(); expect(coordinator.snapshot()[service]).toBe(accepted);
        await writer.query('ROLLBACK');
        await coordinator.reconcile(); expect(coordinator.snapshot()[service]).toBe(accepted);
        await writer.query(sql, [value]);
        await coordinator.reconcile();
        expect(coordinator.snapshot()[service].failure.code).toBe('configuration_changed');
    });
});

test.each(['ollama', 'mediaServer'])('%s ignores unrelated timestamps', async service => {
    await fixture(service, async ({ writer, coordinator, accepted }) => {
        await writer.query('UPDATE health_provider_fixture.ai_provider_config SET updated_at=NOW(),current_month_usage_usd=123');
        await writer.query('UPDATE health_provider_fixture.media_server SET last_sync=NOW(),catalog_revision=42');
        await coordinator.reconcile(); expect(coordinator.snapshot()[service]).toBe(accepted);
    });
});

test('active legacy Ollama endpoint wins and membership changes retire observations', async () => {
    await getPool().query("INSERT INTO health_provider_fixture.ollama_config (id,host,port,is_active) VALUES (1,'legacy.invalid',5678,true)");
    await fixture('ollama', async ({ read, writer, coordinator, accepted }) => {
        expect((await read()).rows[0]).toMatchObject({ ollama_host: 'legacy.invalid', ollama_port: 5678, ollama_config_id: 1 });
        await writer.query("UPDATE health_provider_fixture.ai_provider_config SET ollama_host='ignored.invalid',ollama_port=9999");
        await writer.query('UPDATE health_provider_fixture.ollama_config SET updated_at=NOW()');
        await coordinator.reconcile(); expect(coordinator.snapshot().ollama).toBe(accepted);
        await writer.query('UPDATE health_provider_fixture.ollama_config SET is_active=false');
        expect((await read()).rows[0]).toMatchObject({ ollama_host: 'ignored.invalid', ollama_port: 9999, ollama_config_id: null });
        await coordinator.reconcile(); expect(coordinator.snapshot().ollama.failure.code).toBe('configuration_changed');
    });
});

test('adding legacy configuration invalidates an AI-endpoint observation', async () => {
    await fixture('ollama', async ({ writer, coordinator }) => {
        await writer.query("INSERT INTO health_provider_fixture.ollama_config (id,host,port,is_active) VALUES (1,'legacy.invalid',5678,true)");
        await coordinator.reconcile(); expect(coordinator.snapshot().ollama.failure.code).toBe('configuration_changed');
    });
});
