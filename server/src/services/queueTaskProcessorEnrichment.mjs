import { parsePayload } from '../utils/queueHelpers.mjs';

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

async function selfHealMissingMetadata(enrichPayload, enrichTmdbId, enrichSourceLibraryId, enrichSourceLibraryName, { db, logger }) {
    if (enrichPayload.itemId && (!enrichTmdbId || !enrichSourceLibraryId)) {
        try {
            const itemResult = await db.query(
                `SELECT msi.tmdb_id, msi.library_id, msi.metadata, l.name as library_name 
                 FROM media_server_items msi 
                 LEFT JOIN libraries l ON msi.library_id = l.id 
                 WHERE msi.id = $1`,
                [enrichPayload.itemId]
            );
            if (itemResult.rows.length > 0) {
                const row = itemResult.rows[0];
                if (!enrichTmdbId && row.tmdb_id) {
                    enrichTmdbId = row.tmdb_id;
                }
                if (!enrichSourceLibraryId && row.library_id) {
                    enrichSourceLibraryId = row.library_id;
                }
                if (!enrichSourceLibraryName && row.library_name) {
                    enrichSourceLibraryName = row.library_name;
                }
                if (!enrichPayload.posterPath && row.metadata) {
                    const itemMetadata = parsePayload(row.metadata);
                    if (itemMetadata?.posterPath) {
                        enrichPayload.posterPath = itemMetadata.posterPath;
                    }
                    if (!enrichPayload.poster_path && itemMetadata?.poster_path) {
                        enrichPayload.poster_path = itemMetadata.poster_path;
                    }
                }
                logger.info('Self-heal: Retrieved missing metadata from database', {
                    itemId: enrichPayload.itemId,
                    tmdbId: enrichTmdbId,
                    libraryId: enrichSourceLibraryId,
                    libraryName: enrichSourceLibraryName
                });
            }
        } catch (lookupError) {
            logger.debug('Self-heal lookup failed', { error: lookupError.message });
        }
    }

    return { enrichTmdbId, enrichSourceLibraryId, enrichSourceLibraryName };
}

export async function processMetadataEnrichmentTask(task, {
    db, logger, metadataEnrichment, enrichmentItemStateService,
    resolveSourceLibraryName: resolveName,
    queueOmdbEnrichmentService, queueTavilyEnrichmentService,
    queueTmdbResolutionService, queueClassificationHistoryService,
    queryWithTimeout, completeTask
}) {
    const { hasTavilyEnrichmentMetadata } = metadataEnrichment;
    const enrichPayload = parsePayload(task.payload);
    if (enrichPayload.itemId) {
        await enrichmentItemStateService.markProcessing(enrichPayload.itemId);
    }
    let enrichTmdbId = enrichPayload.tmdbId || enrichPayload.tmdb_id;
    let enrichSourceLibraryId = enrichPayload.source_library_id;
    let enrichSourceLibraryName = enrichPayload.source_library_name;

    ({ enrichTmdbId, enrichSourceLibraryId, enrichSourceLibraryName } =
        await selfHealMissingMetadata(enrichPayload, enrichTmdbId, enrichSourceLibraryId, enrichSourceLibraryName, { db, logger }));

    enrichSourceLibraryName = await resolveName(
        enrichSourceLibraryId,
        enrichSourceLibraryName,
        {
            itemId: enrichPayload.itemId,
            title: enrichPayload.title
        }
    );

    const enrichmentData = {
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

    await queueOmdbEnrichmentService.enrich(enrichPayload, enrichmentData);

    await queueTavilyEnrichmentService.enrich(enrichPayload, enrichmentData);

    if (enrichPayload.itemId) {
        const historyPayload = {
            ...enrichPayload,
            source_library_id: enrichSourceLibraryId,
            source_library_name: enrichSourceLibraryName
        };

        enrichmentData.content_analysis = {
            ...enrichmentData.content_analysis,
            type: enrichPayload.media?.media_type || 'unknown',
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

        await queryWithTimeout(
            `UPDATE media_server_items 
             SET metadata = metadata || $1::jsonb
             WHERE id = $2`,
            [JSON.stringify(enrichmentData), enrichPayload.itemId]
        );

        await queueClassificationHistoryService.persist(
            historyPayload,
            enrichTmdbId,
            enrichSourceLibraryId,
            enrichSourceLibraryName,
            task.id
        );

        const hasTavily = hasTavilyEnrichmentMetadata(enrichmentData);
        logger.info('Metadata enrichment complete (no AI, from source library)', {
            itemId: enrichPayload.itemId,
            title: enrichPayload.title,
            sourceLibrary: enrichSourceLibraryName,
            tavilyEnriched: hasTavily
        });
    }

    await completeTask(task.id, {
        enriched: true,
        sourceLibrary: enrichSourceLibraryName,
        tavilyEnriched: hasTavilyEnrichmentMetadata(enrichmentData)
    });

    if (enrichPayload.itemId) {
        await enrichmentItemStateService.syncItemState(enrichPayload.itemId);
    }
}
