import { pool } from '../config/database.mjs';
import { mediaSyncDatabase as db } from './mediaSyncDatabaseScope.mjs';
import { createMediaSyncOwnership } from './mediaSyncOwnership.mjs';
import { backgroundResourceAdmission } from './backgroundResourceAdmission.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import * as errorsModule from '../utils/errors.mjs';
import { getMediaServerService as defaultGetMediaServerService } from './mediaServers/index.mjs';
import { mediaSyncLibraryStateService } from './mediaSyncLibraryStateService.mjs';
import { MediaSourceObservationStore } from './mediaSourceObservationStore.mjs';
import { runOwnedMediaSync } from './mediaSyncRun.mjs';
import { createMediaSyncSkipReporter } from './mediaSyncSkipReporter.mjs';
import { createMediaSyncIdentityRecovery } from './mediaSyncIdentityRecovery.mjs';
import { persistRecoveredSyncItem } from './mediaSyncIdentityRecoveryPersistence.mjs';
import { upsertMediaItem as _upsertMediaItem, upsertCollection as _upsertCollection } from './mediaSyncUpsert.mjs';
import { pruneMissingMediaItems as _pruneMissingMediaItems, pruneMissingCollections as _pruneMissingCollections, getSyncStatus as _getSyncStatus, getLibraryItems as _getLibraryItems, syncLibrariesFromMediaServer as _syncLibrariesFromMediaServer } from './mediaSyncQueries.mjs';

const logger = createLogger('mediaSync');

export class MediaSyncService {
  constructor(deps = {}) {
    this.resourceAdmission = deps.resourceAdmission || backgroundResourceAdmission;
    this.withOwnership = deps.withOwnership || createMediaSyncOwnership({ pool });
    this.errors = deps.errors || errorsModule;
    this.mediaServerServices = deps.mediaServerServices || {
      getMediaServerService: defaultGetMediaServerService,
    };
    this.mediaSyncLibraryStateService = deps.mediaSyncLibraryStateService || mediaSyncLibraryStateService;
    this.sourceObservations = deps.sourceObservations || new MediaSourceObservationStore();
    this.createIdentityRecovery = deps.createIdentityRecovery || createMediaSyncIdentityRecovery;
    this.persistIdentityRecovery = deps.persistIdentityRecovery || persistRecoveredSyncItem;
    this.skipReporter = deps.skipReporter || createMediaSyncSkipReporter({ query: db.query, logger });
  }

  async syncLibrary(libraryId, options = {}) {
    if (options.batchSize !== undefined && (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 1000)) {
      throw new TypeError('Sync batch size must be an integer from 1 to 1000');
    }
    const permit = this.resourceAdmission.tryAcquire('ingestion');
    if (!permit.allowed) return { success: false, deferred: true,
      reason: permit.reason === 'busy' ? 'ingestion_capacity' : `resource_${permit.reason}` };
    try {
      return await this.withOwnership(libraryId, owner => runOwnedMediaSync(this, libraryId, options, owner));
    } finally { permit.release(); }
  }
  async findExistingMedia(tmdbId, mediaType) {
    return this.mediaSyncLibraryStateService.findExistingMedia(tmdbId, mediaType);
  }

  async getLibraryContext(tmdbId, metadata) {
    return this.mediaSyncLibraryStateService.getLibraryContext(tmdbId, metadata);
  }

  async upsertMediaItem(mediaServerId, libraryId, item, options = {}) {
    return _upsertMediaItem(mediaServerId, libraryId, item, options);
  }

  async upsertCollection(...args) {
    return _upsertCollection(...args);
  }

  async pruneMissingMediaItems(...args) {
    return _pruneMissingMediaItems(...args);
  }

  async pruneMissingCollections(...args) {
    return _pruneMissingCollections(...args);
  }

  async getSyncStatus(...args) {
    return _getSyncStatus(...args);
  }

  async getLibraryItems(...args) {
    return _getLibraryItems(...args);
  }

  async getMediaServerService(type) {
    const { getMediaServerService } = this.mediaServerServices;
    return getMediaServerService(type);
  }

  async reconcileAwaitingDecisions(libraryId) {
    return this.mediaSyncLibraryStateService.reconcileAwaitingDecisions(libraryId);
  }

  async syncAllLibraries() {
    return withServiceCatch(logger, 'Failed to sync all libraries', async () => {
      logger.info('Starting fresh sync of all libraries from media server');
      const syncedLibraries = await this.syncLibrariesFromMediaServer();

      for (const library of syncedLibraries) {
        await this.syncLibrary(library.id);
      }

      logger.info('Fresh sync completed', { libraryCount: syncedLibraries.length });
    });
  }

  async syncLibrariesFromMediaServer() {
    return _syncLibrariesFromMediaServer((type) => this.getMediaServerService(type));
  }
}

export const mediaSyncService = new MediaSyncService();
