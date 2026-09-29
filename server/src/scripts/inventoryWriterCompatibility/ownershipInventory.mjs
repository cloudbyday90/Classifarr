/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { evaluateWriterInventory } from './inventory.mjs';

export const INGESTION_RELATIONS = Object.freeze([
    'media_server_items', 'media_server_sync_status', 'media_source_capture_state', 'library_ingestion_state',
]);
// Explicit dependency pins complement discovery; they are not a call-graph proof.
export const INGESTION_GUARDS = Object.freeze([
    'server/src/services/mediaSync.mjs',
    'server/src/services/mediaSyncRun.mjs',
    'server/src/services/mediaSyncCompleteness.mjs',
    'server/src/services/sourceEnumerationError.mjs',
    'server/src/services/sourceEnumerationPreflight.mjs',
    'server/src/services/sourcePreflightDiagnostic.mjs',
    'server/src/services/sourceContentAdmission.mjs',
    'server/src/services/sourceContentCircuitRepository.mjs',
    'server/src/services/sourceContentFailure.mjs',
    'server/src/services/sourceContentStatus.mjs',
    'server/src/services/mediaServers/plex.mjs',
    'server/src/services/mediaServers/emby.mjs',
    'server/src/services/mediaServers/jellyfin.mjs',
    'server/src/services/mediaServers/embyLibraryCatalog.mjs',
    'server/src/services/mediaServers/embyLibraryCatalogPage.mjs',
    'server/src/services/mediaServers/shared/virtualFolderCatalog.mjs',
    'server/src/services/mediaServers/shared/createEmbyLikeService.mjs',
    'server/src/services/mediaServers/shared/sourcePage.mjs',
    'server/src/services/mediaServers/shared/libraryCatalog.mjs',
    'server/src/services/libraryCatalogContext.mjs',
    'server/src/services/libraryDiscoveryObservation.mjs',
    'server/src/services/libraryDiscoveryFailure.mjs',
    'server/src/services/libraryDiscoveryStatusRepository.mjs',
    'server/src/services/libraryCatalogSession.mjs',
    'server/src/services/libraryCatalogRecovery.mjs',
    'server/src/services/libraryCatalogRecoveryPolicy.mjs',
    'server/src/services/libraryCatalogRetryAfter.mjs',
    'server/src/services/mediaServerLibrarySync.mjs',
    'server/src/services/libraryArchiveService.mjs',
    'server/src/services/libraryArchiveRepository.mjs',
    'server/src/services/libraryArchiveContract.mjs',
    'server/src/routes/mediaServerRouteArchive.mjs',
    'server/src/services/mediaSyncOwnership.mjs',
    'server/src/services/mediaSyncOwnershipRepository.mjs',
    'server/src/services/libraryIngestionPredicates.mjs',
    'server/src/services/libraryIngestionStatus.mjs',
    'server/src/services/inventoryBackgroundReadiness.mjs',
    'server/src/services/queueRefillCandidates.mjs',
    'server/src/services/queueRefillService.mjs',
    'server/src/services/queueRefillCoordination.mjs',
    'server/src/services/queueClaimWriteGuard.mjs',
    'server/src/services/queueEnrichmentWriteSession.mjs',
    'server/src/services/queueTaskProcessorEnrichment.mjs',
    'server/src/services/queueTaskProcessorService.mjs',
    'server/src/services/queueTaskAcknowledgementService.mjs',
    'server/src/services/queueClassificationHistoryService.mjs',
    'server/src/services/queueOmdbEnrichmentService.mjs',
    'server/src/services/queueTmdbResolutionService.mjs',
    'server/src/services/enrichmentRetryService.mjs',
    'server/src/services/enrichmentRetryClaimService.mjs',
    'server/src/services/enrichmentRetryProcessing.mjs',
    'server/src/services/enrichmentRetrySchedulePolicy.mjs',
    'server/src/services/enrichmentRetryDispatch.mjs',
    'server/src/services/enrichmentRetryCredentialGate.mjs',
    'server/src/services/providerRecoveryProbeQueries.mjs',
    'server/src/services/providerRecoveryProbePolicy.mjs',
    'server/src/services/providerRecoveryProbeQuota.mjs',
    'server/src/services/providerRecoveryProbeRepository.mjs',
    'server/src/services/providerRecoveryProbeService.mjs',
    'server/src/services/providerRecoveryProbeTransport.mjs',
    'server/src/services/enrichmentRetryResultPersistence.mjs',
    'server/src/services/enrichmentRetryMaintenance.mjs',
    'server/src/services/enrichmentRetryOmdb.mjs',
    'server/src/services/enrichmentRetryWebSearch.mjs',
    'server/src/services/legacyEnrichmentRetryContract.mjs',
    'server/src/services/legacyEnrichmentRetryRepository.mjs',
    'server/src/services/legacyEnrichmentRetryService.mjs',
    'server/src/routes/librariesRouteLegacyRetries.mjs',
    'server/src/services/mediaSyncDatabaseScope.mjs',
    'server/src/services/mediaSourceCaptureContext.mjs',
    'server/src/services/mediaSyncIdentityRecoveryOutcomes.mjs',
    'server/src/services/mediaSyncLockKeys.mjs',
    'server/src/services/mediaSyncItemPersistence.mjs',
    'server/src/services/mediaSyncUpsert.mjs',
    'server/src/services/legacyIngestionService.mjs',
    'server/src/services/legacyIngestionContract.mjs',
    'server/src/services/legacyIngestionRecoveryPolicy.mjs',
    'server/src/utils/databaseClientLease.mjs',
]);
const digest = value => createHash('sha256').update(value).digest('hex');

/** Reuse the existing static discovery without loading application modules or connecting to a database. */
export function collectOwnershipInventory(files, gaps = [], guards = INGESTION_GUARDS) {
    // Git's Windows checkout conversion must not invalidate a Linux review.
    const normalized = files.map(file => ({ ...file, source: file.source.replace(/\r\n/g, '\n') }));
    const report = evaluateWriterInventory(normalized, gaps, INGESTION_RELATIONS);
    const watched = new Set([...report.candidates, ...report.gaps].map(item => item.path));
    for (const path of guards) watched.add(path);
    // SQL DDL, trigger functions and migration side effects cannot be dismissed by a DML-only scanner.
    for (const file of normalized) if (file.path.endsWith('.sql')) watched.add(file.path);
    const sources = new Map(normalized.map(file => [file.path, file.source]));
    const entries = [...watched].sort().map(path => ({ path,
        digest: sources.has(path) ? digest(sources.get(path)) : null,
        operations: [...new Set(report.candidates.filter(item => item.path === path).map(item => `${item.operation}:${item.target}`))].sort(),
        gaps: [...new Set(report.gaps.filter(item => item.path === path).map(item => item.reason))].sort(),
        dependency: guards.includes(path),
    })).map(entry => ({ ...entry, analysisDigest: digest(JSON.stringify([entry.operations, entry.gaps, entry.dependency])) }));
    return { ...report, contract: 'inventory.ownership-inventory.v1', protectedRelations: INGESTION_RELATIONS, entries };
}
