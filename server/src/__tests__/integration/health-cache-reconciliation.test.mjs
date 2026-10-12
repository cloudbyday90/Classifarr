/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { createHealthObservationCoordinator } from '../../services/healthObservationCoordinator.mjs';
import { readHealthConfiguration } from '../../services/healthConfigurationRead.mjs';

// The integration runner creates a unique disposable suite database.
beforeAll(async () => {
    await getPool().query('CREATE TABLE health_cache_fixture (id integer PRIMARY KEY, enabled boolean, endpoint text)');
});

test.each(['endpoint', 'disable', 'delete'])('reconciliation observes only committed %s changes from a different connection', async change => {
    const reader = await getPool().connect();
    const writer = await getPool().connect();
    try {
        await writer.query("INSERT INTO health_cache_fixture VALUES (1,true,'old fixture') ON CONFLICT(id) DO UPDATE SET enabled=true,endpoint='old fixture'");
        const coordinator = createHealthObservationCoordinator();
        let probes = 0;
        const compute = async (previous, guard) => {
            const configuration = await readHealthConfiguration(previous, 'radarr',
                () => reader.query('SELECT * FROM health_cache_fixture WHERE enabled=true'), guard);
            if (!configuration.ok) return configuration.health;
            probes++;
            return { status: configuration.rows.length ? 'connected' : 'not configured',
                lastCheck: '2026-10-12T12:00:00.000Z', lastSuccessfulCheck: '2026-10-12T12:00:00.000Z' };
        };
        const accepted = await coordinator.run('radarr', compute);
        const sql = {
            endpoint: "UPDATE health_cache_fixture SET endpoint='new fixture'",
            disable: 'UPDATE health_cache_fixture SET enabled=false',
            delete: 'DELETE FROM health_cache_fixture',
        }[change];
        await writer.query('BEGIN');
        await writer.query(sql);
        await coordinator.reconcile();
        expect(coordinator.snapshot().radarr).toBe(accepted);
        await writer.query('ROLLBACK');
        await coordinator.reconcile();
        expect(coordinator.snapshot().radarr).toBe(accepted);
        await writer.query('BEGIN');
        await writer.query(sql);
        await writer.query('COMMIT');
        await coordinator.reconcile();
        expect(coordinator.snapshot().radarr).toMatchObject({
            status: 'unknown', lastCheck: accepted.lastCheck,
            lastSuccessfulCheck: accepted.lastSuccessfulCheck,
            failure: { stage: 'configuration_reconciliation', code: 'configuration_changed' },
        });
        expect(probes).toBe(1);
        await coordinator.run('radarr', compute);
        expect(coordinator.snapshot().radarr.status).toBe(change === 'endpoint' ? 'connected' : 'not configured');
    } finally {
        await writer.query('ROLLBACK');
        reader.release(); writer.release();
    }
});
