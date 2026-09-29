import { parsePayload } from '../utils/queueHelpers.mjs';
import { prepareQueueEnrichmentPayload } from './queueEnrichmentPayload.mjs';
import { persistEnrichmentMetadata } from './queueEnrichmentPersistence.mjs';
import { SOURCE_CONFLICT_AUTHORITY_BLOCK_REASON } from './sourceConflictAuthorityGuard.mjs';
import { reportInventoryProviderRecovery } from './inventoryProviderRecoveryReporting.mjs';
import { createQueueEnrichmentWriteSession } from './queueEnrichmentWriteSession.mjs';
import { QueueClaimWriteError } from './queueClaimWriteGuard.mjs';

export async function resolveSourceLibraryName(sourceLibraryId, sourceLibraryName, taskContext, { db, logger }) {
    if (sourceLibraryName || !sourceLibraryId) {
        return sourceLibraryName;
    }

    try {
        const result = await db.query(
            'SELECT name FROM libraries WHERE id = $1',
            [sourceLibraryId]
        );

        const resolvedName = result.rows[0]?.name || null;
        if (resolvedName) {
            logger.info('Self-heal: Retrieved missing source library name from libraries table', {
                libraryId: sourceLibraryId,
                libraryName: resolvedName,
                ...taskContext
            });
        }

        return resolvedName;
    } catch (lookupError) {
        logger.debug('Source library name lookup failed', {
            libraryId: sourceLibraryId,
            error: lookupError.message,
            ...taskContext
        });
        return sourceLibraryName;
    }
}

export async function processMetadataEnrichmentTask(task, {
    db, logger, metadataEnrichment, enrichmentItemStateService,
    resolveSourceLibraryName: resolveName,
    queueOmdbEnrichmentService, queueWebSearchEnrichmentService,
    queueTmdbResolutionService, queueInventoryTmdbEnrichmentService, queueClassificationHistoryService,
    createWriteSession = createQueueEnrichmentWriteSession
}) {
    const writes = createWriteSession({ db, task, logger, enrichmentItemStateService });
    const { hasWebSearchEnrichmentMetadata } = metadataEnrichment;
    const enrichPayload = await prepareQueueEnrichmentPayload(parsePayload(task.payload),
        (text, values) => db.query(text, values));
    if (!enrichPayload) {
        logger.warn('Metadata enrichment skipped', { reason: 'invalid_media_identity' });
        await writes.finish({ enriched: false, skipped: true, reason: 'invalid_media_identity' });
        return;
    }
    if (enrichPayload.source_conflict_blocks_authority === true) {
        logger.warn('Metadata enrichment skipped', { reason: SOURCE_CONFLICT_AUTHORITY_BLOCK_REASON });
        await writes.finish({ enriched: false, skipped: true, reason: SOURCE_CONFLICT_AUTHORITY_BLOCK_REASON });
        return;
    }
    if (enrichPayload.itemId) {
        await writes.markProcessing(enrichPayload.itemId);
    }
    const skipChangedSource = async () => {
        logger.warn('Metadata enrichment skipped', { reason: 'source_identity_changed' });
        await writes.finish({ enriched: false, skipped: true, reason: 'source_identity_changed' }, enrichPayload.itemId);
    };
    let enrichTmdbId = enrichPayload.tmdb_id;
    const enrichSourceLibraryId = enrichPayload.source_library_id;
    let enrichSourceLibraryName = enrichPayload.source_library_name;

    enrichSourceLibraryName = await resolveName(
        enrichSourceLibraryId,
        enrichSourceLibraryName,
        {
            itemId: enrichPayload.itemId,
            title: enrichPayload.title
        }
    );

    const observationOnly = enrichPayload.inventory_tmdb_only === true;
    let observationStatus = 'unchanged';
    const enrichmentData = observationOnly ? {} : {
        source_library_id: enrichSourceLibraryId,
        source_library_name: enrichSourceLibraryName,
        content_analysis: {
            type: 'source_library',
            confidence: 100,
            detected_at: new Date().toISOString(),
            source: 'metadata_enrichment',
            source_library_id: enrichSourceLibraryId,
            source_library_name: enrichSourceLibraryName
        }
    };

    if (!observationOnly) {
        await queueOmdbEnrichmentService.enrich(enrichPayload, enrichmentData, writes);
        await queueWebSearchEnrichmentService.enrich(enrichPayload, enrichmentData);
    }

    let persist = async () => {};
    const recoveryReceipt = {};
    if (enrichPayload.itemId) {
        const historyPayload = {
            ...enrichPayload,
            source_library_id: enrichSourceLibraryId,
            source_library_name: enrichSourceLibraryName
        };

        if (!observationOnly) {
            enrichmentData.content_analysis = {
                ...enrichmentData.content_analysis,
                type: enrichPayload.media.media_type,
                confidence: 100,
                method: 'source_library',
                source: 'metadata_enrichment',
                detected_at: new Date().toISOString()
            };

            enrichTmdbId = await queueTmdbResolutionService.resolveAndBackfill(
                enrichPayload,
                enrichmentData,
                enrichTmdbId,
                writes
            );
        }
        const attempted = await queueInventoryTmdbEnrichmentService.enrich(enrichPayload, enrichmentData, enrichTmdbId,
            { query: writes.query, receipt: recoveryReceipt });

        observationStatus = enrichmentData.inventory_tmdb ? 'captured' : attempted ? 'unavailable' : 'unchanged';
        persist = async client => {
            const updated = await persistEnrichmentMetadata(
                client.query, enrichPayload, enrichTmdbId, enrichmentData, attempted, recoveryReceipt);
            if (updated.rowCount !== 1) throw new QueueClaimWriteError('source_identity_changed');
            if (!observationOnly) {
                const saved = await queueClassificationHistoryService.persist(
                    historyPayload, enrichTmdbId, enrichSourceLibraryId, enrichSourceLibraryName, task.id, client);
                if (saved === false) throw new QueueClaimWriteError('source_identity_changed');
            }
        };
    }

    const result = {
        enriched: !observationOnly || observationStatus === 'captured',
        ...(observationOnly ? { inventoryObservationStatus: observationStatus } : {}),
        sourceLibrary: enrichSourceLibraryName,
        webSearchEnriched: hasWebSearchEnrichmentMetadata(enrichmentData)
    };
    try {
        await writes.finish(result, enrichPayload.itemId, persist);
    } catch (error) {
        if (error instanceof QueueClaimWriteError && error.reason === 'source_identity_changed') return skipChangedSource();
        throw error;
    }
    reportInventoryProviderRecovery(logger, enrichPayload, recoveryReceipt);
    if (enrichPayload.itemId) {
        logger.info('Metadata enrichment complete (no AI, from source library)', {
            itemId: enrichPayload.itemId, title: enrichPayload.title,
            sourceLibrary: enrichSourceLibraryName, webSearchEnriched: result.webSearchEnriched,
        });
    }
}
