/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

// Load production services only after the isolated database module has been installed.
const { createHandoffFixture, observationFixture } = await import('../helpers/sourceRecoveryHandoffFixture.mjs');
const { policyProfileRefreshOutboxWorkerRepository } = await import('../../services/policyProfileRefreshOutboxWorkerRepository.mjs');
const db = createIntegrationDatabaseModuleMock();
let fixture;
afterEach(async () => { await fixture?.cleanup(); fixture = undefined; });

async function expectNoRouting(target = fixture) {
    expect(target.classify).not.toHaveBeenCalled();
    expect((await target.tasks()).every(task => task.task_type === 'metadata_enrichment')).toBe(true);
    for (const row of await target.history()) {
        expect(row.method).toBe('source_library');
        expect(row.metadata.classification_details.candidate_capture).toMatchObject({
            status: 'not_applicable', source: null, library_id: null,
        });
    }
    expect(target.log.error).not.toHaveBeenCalled();
}

async function expectCurrentProfile(target = fixture) {
    const status = await target.status();
    expect(status.statusId).toBe('current');
    expect(status.acknowledgedRevision).toBe(status.sourceRevision);
    expect(status.profileRevision).toBe(status.sourceRevision);
    const profile = await target.profile();
    expect(profile.item_count).toBe(1);
    expect(profile.observation_summary.traits.keywords).toMatchObject({ observedCount: 1,
        entries: [{ value: 'space', count: 1 }] });
}

test.each(['movie', 'tv'])('%s outage returns to repaired, enriched and current without manual handoff', async mediaType => {
    fixture = await createHandoffFixture(db, mediaType);
    fixture.provider.findIdentityByExternalId.mockRejectedValueOnce(new Error('synthetic outage'))
        .mockRejectedValueOnce(new Error('synthetic outage'));
    expect(await fixture.scan()).toMatchObject({ success: true, ignoredItems: 1 });
    expect((await fixture.unresolved()).map(row => row.recovery_outcome)).toEqual(['provider_unavailable', 'provider_unavailable']);
    expect(await fixture.inventory()).toEqual([]);
    expect(await fixture.queue().refillQueue()).toEqual({ queued: 0 });
    expect((await fixture.plan()).queued).toBe(0);

    // A returning provider alone must not bypass the durable daily cooldown.
    await fixture.scan();
    expect(fixture.provider.findIdentityByExternalId).toHaveBeenCalledTimes(2);
    await fixture.dueRecovery();
    await fixture.scan();
    expect(await fixture.unresolved()).toEqual([expect.objectContaining({ external_id: 'changed-source', recovery_outcome: 'source_changed' })]);
    expect(await fixture.inventory()).toEqual([expect.objectContaining({ external_id: 'repairable', tmdb_id: 22, media_type: mediaType })]);
    expect((await fixture.inventory())[0].metadata.source_identity_recovery.persisted_at).toEqual(expect.any(String));

    // Simulate interruption after repair and after enqueue by replacing service instances.
    expect(await fixture.queue().refillQueue()).toEqual({ queued: 1 });
    const queue = fixture.queue();
    expect(await queue.refillQueue()).toEqual({ queued: 0 });
    const task = await fixture.claim(queue);
    expect(task.status).toBe('processing');
    await queue.queueTaskProcessorService.processMetadataEnrichmentTask(task);
    expect((await fixture.tasks())[0].status).toBe('completed');
    expect(await fixture.history()).toHaveLength(1);
    expect(fixture.observationMethod).toHaveBeenCalledTimes(1);
    expect((await fixture.inventory())[0].metadata.inventory_tmdb.keywords).toEqual(['space']);

    expect((await fixture.plan()).queued).toBe(1);
    expect((await fixture.worker({ profileService: { generateProfile: async () => { throw new Error('synthetic refresh failure'); } } }).run()).retried).toBe(1);
    expect((await fixture.status()).statusId).not.toBe('current');
    expect(await fixture.profile()).toBeUndefined();
    expect((await fixture.worker().run()).claimed).toBe(0);
    await db.query("UPDATE policy_profile_refresh_outbox SET available_at=NOW()-INTERVAL '1 second' WHERE library_id=$1", [fixture.libraryId]);
    expect((await fixture.worker().run()).completed).toBe(1);
    await expectCurrentProfile();

    const before = (await fixture.inventory())[0];
    const revision = (await fixture.status()).sourceRevision;
    await fixture.scan();
    expect(fixture.provider.findIdentityByExternalId).toHaveBeenCalledTimes(4);
    expect((await fixture.inventory())[0].metadata.inventory_tmdb).toEqual(before.metadata.inventory_tmdb);
    expect((await fixture.inventory())[0].inventory_tmdb_fetched_at).toEqual(before.inventory_tmdb_fetched_at);
    expect(await fixture.queue().refillQueue()).toEqual({ queued: 0 });
    expect((await fixture.plan()).queued).toBe(0);
    expect((await fixture.status()).sourceRevision).toBe(revision);
    expect(await fixture.tasks()).toHaveLength(1);
    expect(await fixture.history()).toHaveLength(1);
    await expectCurrentProfile();
    await expectNoRouting();
});

test.each(['movie', 'tv'])('%s profile publication resumes after interrupted acknowledgement without losing its revision', async mediaType => {
    fixture = await createHandoffFixture(db, mediaType);
    await fixture.scan();
    const queue = fixture.queue();
    await queue.refillQueue();
    await queue.queueTaskProcessorService.processMetadataEnrichmentTask(await fixture.claim(queue));
    expect((await fixture.plan()).queued).toBe(1);
    const interrupted = fixture.worker({ outboxRepository: { ...policyProfileRefreshOutboxWorkerRepository,
        completeClaim: async () => { throw new Error('synthetic interruption after publication'); },
    } });
    expect((await interrupted.run()).retried).toBe(1);
    const status = await fixture.status();
    expect(status.profileRevision).toBe(status.sourceRevision);
    expect(status.acknowledgedRevision).not.toBe(status.sourceRevision);
    expect(status.statusId).not.toBe('current');
    const outbox = (await db.query('SELECT id,attempt_count FROM policy_profile_refresh_outbox WHERE library_id=$1', [fixture.libraryId])).rows;
    expect(outbox).toHaveLength(1);
    expect(outbox[0].attempt_count).toBe(1);
    expect((await fixture.plan()).queued).toBe(0);
    expect((await fixture.worker().run()).claimed).toBe(0);
    await db.query("UPDATE policy_profile_refresh_outbox SET available_at=NOW()-INTERVAL '1 second' WHERE id=$1", [outbox[0].id]);
    expect((await fixture.worker().run()).completed).toBe(1);
    expect((await db.query('SELECT id,attempt_count,processing_state FROM policy_profile_refresh_outbox WHERE library_id=$1', [fixture.libraryId])).rows)
        .toEqual([{ id: outbox[0].id, attempt_count: 2, processing_state: 'completed' }]);
    expect(fixture.observationMethod).toHaveBeenCalledTimes(1);
    await expectCurrentProfile();
    await expectNoRouting();
});

test('mixed movie/TV recovery keeps equal numeric provider IDs separate across libraries', async () => {
    fixture = await createHandoffFixture(db, 'movie');
    const television = await createHandoffFixture(db, 'tv');
    try {
        await fixture.scan();
        await television.scan();
        const queue = fixture.queue();
        expect(await queue.refillQueue()).toEqual({ queued: 2 });
        const claims = await Promise.all([fixture.claim(queue), television.claim(television.queue())]);
        expect(claims.every(task => task?.status === 'processing')).toBe(true);
        expect(new Set(claims.map(task => task.id)).size).toBe(2);
        for (const task of claims) await queue.queueTaskProcessorService.processMetadataEnrichmentTask(task);
        expect(fixture.provider.getMovieDetails).toHaveBeenCalledTimes(1);
        expect(fixture.provider.getTVDetails).toHaveBeenCalledTimes(1);
        expect(await fixture.history()).toEqual([expect.objectContaining({ tmdb_id: 22, media_type: 'movie', library_id: fixture.libraryId })]);
        expect(await television.history()).toEqual([expect.objectContaining({ tmdb_id: 22, media_type: 'tv', library_id: television.libraryId })]);
        expect((await fixture.plan()).queued).toBe(2);
        expect((await television.worker().run()).completed).toBe(2);
        await expectCurrentProfile();
        await expectCurrentProfile(television);
        expect((await fixture.profile()).observation_summary.traits.language.entries).toEqual([expect.objectContaining({ value: 'ja' })]);
        expect((await television.profile()).observation_summary.traits.language.entries).toEqual([expect.objectContaining({ value: 'fr' })]);
        expect(await fixture.queue().refillQueue()).toEqual({ queued: 0 });
        expect((await fixture.plan()).queued).toBe(0);
        await expectNoRouting();
        await expectNoRouting(television);
    } finally { await television.cleanup(); }
});

test.each(['movie', 'tv'])('%s committed enrichment resumes after lost acknowledgement without duplicate observations or history', async mediaType => {
    fixture = await createHandoffFixture(db, mediaType);
    await fixture.scan();
    const interrupted = fixture.queue({ beforeComplete: async () => { throw new Error('synthetic interruption before ack'); } });
    expect(await interrupted.refillQueue()).toEqual({ queued: 1 });
    const task = await fixture.claim(interrupted);
    await expect(interrupted.queueTaskProcessorService.processMetadataEnrichmentTask(task)).rejects.toThrow('synthetic interruption before ack');
    expect((await fixture.tasks())[0].status).toBe('processing');
    const revision = (await fixture.status()).sourceRevision;
    expect(await fixture.history()).toHaveLength(1);
    expect(fixture.observationMethod).toHaveBeenCalledTimes(1);

    const resumed = fixture.queue();
    expect(await resumed.refillQueue()).toEqual({ queued: 0 });
    expect(await fixture.claim(resumed)).toBeNull();
    await db.query("UPDATE task_queue SET visible_at=NOW()-INTERVAL '1 second' WHERE id=$1", [task.id]);
    const redelivery = await fixture.claim(resumed);
    expect(redelivery.id).toBe(task.id);
    await resumed.queueTaskProcessorService.processMetadataEnrichmentTask(redelivery);
    expect((await fixture.tasks())[0].status).toBe('completed');
    expect(fixture.observationMethod).toHaveBeenCalledTimes(1);
    expect(await fixture.history()).toHaveLength(1);
    expect((await fixture.status()).sourceRevision).toBe(revision);
    expect((await fixture.plan()).queued).toBe(1);
    expect((await fixture.worker().run()).completed).toBe(1);
    await expectCurrentProfile();
    await expectNoRouting();
});

test.each(['movie', 'tv'])('%s source changes during backfill reject old metadata and a later repair can resume', async mediaType => {
    fixture = await createHandoffFixture(db, mediaType);
    await fixture.scan();
    const queue = fixture.queue();
    await queue.refillQueue();
    const task = await fixture.claim(queue);
    fixture.observationMethod.mockImplementationOnce(async () => {
        await db.query('UPDATE media_server_items SET tmdb_id=33 WHERE library_id=$1', [fixture.libraryId]);
        return observationFixture(mediaType);
    });
    await queue.queueTaskProcessorService.processMetadataEnrichmentTask(task);
    expect((await fixture.tasks())[0].payload.result).toMatchObject({ enriched: false, skipped: true, reason: 'source_identity_changed' });
    expect((await fixture.inventory())[0].metadata.inventory_tmdb).toBeUndefined();
    expect(await fixture.history()).toEqual([]);

    // A fresh scan must validate again: the previous receipt no longer binds to tmdb_id.
    await fixture.scan();
    expect((await fixture.inventory())[0].tmdb_id).toBe(22);
    const resumed = fixture.queue();
    expect(await resumed.refillQueue()).toEqual({ queued: 1 });
    await resumed.queueTaskProcessorService.processMetadataEnrichmentTask(await fixture.claim(resumed));
    expect((await fixture.plan()).queued).toBe(1);
    expect((await fixture.worker().run()).completed).toBe(1);
    await expectCurrentProfile();
    expect(await fixture.history()).toHaveLength(1);
    expect(fixture.observationMethod).toHaveBeenCalledTimes(2);
    await expectNoRouting();
});
