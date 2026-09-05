import { parsePayload } from '../utils/queueHelpers.mjs';
import { prepareQueueEnrichmentPayload } from './queueEnrichmentPayload.mjs';
import { persistEnrichmentMetadata } from './queueEnrichmentPersistence.mjs';

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
    queryWithTimeout, completeTask
}) {
    const { hasWebSearchEnrichmentMetadata } = metadataEnrichment;
    const enrichPayload = await prepareQueueEnrichmentPayload(parsePayload(task.payload),
        (text, values) => db.query(text, values));
    if (!enrichPayload) {
        logger.warn('Metadata enrichment skipped', { reason: 'invalid_media_identity' });
        await completeTask(task.id, { enriched: false, skipped: true, reason: 'invalid_media_identity' });
        return;
    }
    if (enrichPayload.itemId) {
        await enrichmentItemStateService.markProcessing(enrichPayload.itemId);
    }
    const skipChangedSource = async () => {
        logger.warn('Metadata enrichment skipped', { reason: 'source_identity_changed' });
        await completeTask(task.id, { enriched: false, skipped: true, reason: 'source_identity_changed' });
        await enrichmentItemStateService.syncItemState(enrichPayload.itemId);
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
        await queueOmdbEnrichmentService.enrich(enrichPayload, enrichmentData);
        await queueWebSearchEnrichmentService.enrich(enrichPayload, enrichmentData);
    }

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
                enrichTmdbId
            );
        }
        const attempted = await queueInventoryTmdbEnrichmentService.enrich(enrichPayload, enrichmentData, enrichTmdbId);

        const updated = await persistEnrichmentMetadata(
            queryWithTimeout, enrichPayload, enrichTmdbId, enrichmentData, attempted);
        if (updated.rowCount !== 1) return skipChangedSource();
        observationStatus = enrichmentData.inventory_tmdb ? 'captured' : attempted ? 'unavailable' : 'unchanged';

        if (!observationOnly) {
            const saved = await queueClassificationHistoryService.persist(
                historyPayload, enrichTmdbId, enrichSourceLibraryId, enrichSourceLibraryName, task.id);
            if (saved === false) return skipChangedSource();
        }

        const hasWebSearch = hasWebSearchEnrichmentMetadata(enrichmentData);
        logger.info('Metadata enrichment complete (no AI, from source library)', {
            itemId: enrichPayload.itemId,
            title: enrichPayload.title,
            sourceLibrary: enrichSourceLibraryName,
            webSearchEnriched: hasWebSearch
        });
    }

    await completeTask(task.id, {
        enriched: !observationOnly || observationStatus === 'captured',
        ...(observationOnly ? { inventoryObservationStatus: observationStatus } : {}),
        sourceLibrary: enrichSourceLibraryName,
        webSearchEnriched: hasWebSearchEnrichmentMetadata(enrichmentData)
    });

    if (enrichPayload.itemId) {
        await enrichmentItemStateService.syncItemState(enrichPayload.itemId);
    }
}
