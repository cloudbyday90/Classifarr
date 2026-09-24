/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { radarrService } from './radarr.mjs';
import { sonarrService } from './sonarr.mjs';
import { libraryMappingService } from './libraryMappingService.mjs';
import { fileOperationsService } from './fileOperationsService.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { prepareMoveEvidence, verifyMoveEvidence, fingerprintMoveFolder } from './reclassificationMoveEvidence.mjs';
import { arrPath, assertSeparatePaths, classificationMoveRevision, mappingRevision,
  moveBlocked, moveProviderIdentity, moveTargetPath } from './reclassificationMoveContract.mjs';

export function createReclassificationMoveAdapter({ database = db, mappings = libraryMappingService,
  radarr = radarrService, sonarr = sonarrService, files = fileOperationsService,
  prepareEvidence = prepareMoveEvidence, verifyEvidence = verifyMoveEvidence,
  fingerprint = fingerprintMoveFolder } = {}) {
  async function context(originalLibraryId, targetLibraryId, mediaType) {
    const type = mediaType === 'movie' ? 'radarr' : mediaType === 'tv' ? 'sonarr' : null;
    if (!type) throw moveBlocked('move_type_unsupported', 'Only movies and TV shows can be reclassified.');
    const libraries = await database.query(`SELECT id FROM libraries
      WHERE id = ANY($1::integer[]) AND is_active IS TRUE AND media_type = $2`, [[originalLibraryId, targetLibraryId], mediaType]);
    if (libraries.rows.length !== 2) throw moveBlocked('move_library_changed', 'Both source and destination must be distinct active libraries of the same media type.');
    const original = await mappings.getLibraryMapping(originalLibraryId);
    const target = await mappings.getLibraryMapping(targetLibraryId);
    if (!original || !target || original.arr_type !== type || target.arr_type !== type ||
        !positiveDatabaseInteger(target.arr_config_id) || original.arr_config_id !== target.arr_config_id) {
      throw moveBlocked('move_mapping_invalid', 'Configure both libraries on the same matching Radarr or Sonarr instance. Cross-instance file moves are not supported.');
    }
    const result = type === 'radarr'
      ? await database.query('SELECT * FROM radarr_config WHERE id = $1 AND is_active IS TRUE', [target.arr_config_id])
      : await database.query('SELECT * FROM sonarr_config WHERE id = $1 AND is_active IS TRUE', [target.arr_config_id]);
    if (!result.rows[0]) throw moveBlocked('move_config_missing', 'The mapped Radarr or Sonarr instance is missing or inactive. Restore its configuration before retrying.');
    const config = result.rows[0], service = type === 'radarr' ? radarr : sonarr;
    const url = config.url || service.buildUrl(config);
    return { original, target, config, service, url };
  }
  function identityMatches(remote, plan) {
    if (!remote || Number(remote.id) !== plan.remoteId ||
        Number(plan.mediaType === 'movie' ? remote.tmdbId : remote.tvdbId) !== plan.providerId) {
      throw moveBlocked('move_remote_identity_changed', 'The expected item is missing or has a different provider identity in Radarr/Sonarr. Refresh its metadata and inspect the mapping before retrying.');
    }
  }
  async function currentContext(plan) {
    const ctx = await context(plan.originalLibraryId, plan.targetLibraryId, plan.mediaType);
    if (mappingRevision(ctx.original, ctx.target, ctx.url) !== plan.mappingRevision ||
        await files.translatePath(plan.oldPath, { fresh: true, strict: true }) !== plan.localOldPath ||
        await files.translatePath(plan.newPath, { fresh: true, strict: true }) !== plan.localNewPath) {
      throw moveBlocked('move_mapping_changed', 'Library or filesystem mappings changed after this move started. Restore the recorded mappings before retrying.');
    }
    const validation = await ctx.service.validatePathInRootFolder(ctx.url, ctx.config.api_key, plan.newPath, { strict: true });
    if (!validation.isValid) throw moveBlocked('move_root_changed', 'The destination is no longer in a configured Radarr/Sonarr root folder. Restore that root before retrying.');
    return ctx;
  }
  async function readRemote(ctx, plan) {
    const remote = plan.mediaType === 'movie'
      ? await ctx.service.getMovieById(ctx.url, ctx.config.api_key, plan.remoteId)
      : await ctx.service.getSeriesById(ctx.url, ctx.config.api_key, plan.remoteId);
    identityMatches(remote, plan);
    if (![plan.oldPath, plan.newPath].includes(arrPath(remote.path))) {
      throw moveBlocked('move_remote_path_changed', 'Radarr/Sonarr now points to a third location. Inspect the item path; recovery will not overwrite that change.');
    }
    return remote;
  }
  return {
    async prepare(classification, targetLibraryId, options) {
      const providerId = moveProviderIdentity(classification);
      const ctx = await context(classification.library_id, targetLibraryId, classification.media_type);
      const remote = classification.media_type === 'movie'
        ? await ctx.service.getMovieByTmdbId(ctx.url, ctx.config.api_key, providerId)
        : await ctx.service.getSeriesByTvdbId(ctx.url, ctx.config.api_key, providerId);
      const remoteId = positiveDatabaseInteger(remote?.id);
      if (!remoteId) throw moveBlocked('move_remote_missing', 'The item was not found in the mapped Radarr/Sonarr instance. Add or match it there before retrying; no move was performed.');
      const oldPath = arrPath(remote.path), newPath = moveTargetPath(ctx.target.arr_root_folder_path, oldPath);
      if (!oldPath.startsWith(`${arrPath(ctx.original.arr_root_folder_path)}/`)) {
        throw moveBlocked('move_source_root_changed', 'The current remote path is outside the mapped source library. Inspect the source mapping before retrying.');
      }
      assertSeparatePaths(oldPath, newPath);
      const validation = await ctx.service.validatePathInRootFolder(ctx.url, ctx.config.api_key, newPath, { strict: true });
      if (!validation.isValid) throw moveBlocked('move_root_invalid', 'The destination is outside the configured Radarr/Sonarr roots.');
      const plan = {
        mediaType: classification.media_type, providerId, remoteId, configId: ctx.target.arr_config_id,
        originalLibraryId: classification.library_id, targetLibraryId,
        oldPath, newPath, localOldPath: await files.translatePath(oldPath, { fresh: true, strict: true }),
        localNewPath: await files.translatePath(newPath, { fresh: true, strict: true }),
        qualityProfileId: ctx.target.quality_profile_id ?? null,
        mappingRevision: mappingRevision(ctx.original, ctx.target, ctx.url),
        classificationStatus: classification.status ?? null,
        classificationRevision: classificationMoveRevision(classification),
      };
      identityMatches(remote, plan);
      return { ...plan, contentDigest: await prepareEvidence(plan.localOldPath, plan.localNewPath, options) };
    },
    async moveFiles(plan, options) {
      const ctx = await currentContext(plan);
      const remote = await readRemote(ctx, plan);
      if (arrPath(remote.path) !== plan.oldPath) throw moveBlocked('move_remote_path_changed', 'The remote path changed before file movement started.');
      options?.signal?.throwIfAborted();
      const result = await files.moveFolder(plan.localOldPath, plan.localNewPath, {
        dryRun: false, skipVerification: false, preservePartialCopy: true,
        beforeSourceDelete: async () => {
          await currentContext(plan);
          if (await fingerprint(plan.localOldPath, options) !== plan.contentDigest ||
              await fingerprint(plan.localNewPath, options) !== plan.contentDigest) {
            throw moveBlocked('move_content_changed', 'Media changed during copying. Both folders were preserved for inspection.');
          }
          options?.signal?.throwIfAborted();
        },
      });
      // Never trust a success flag alone: recovery independently verifies disk contents.
      if (!result.success) throw new Error('move_files_incomplete');
    },
    async reconcile(plan, options) {
      await currentContext(plan);
      await verifyEvidence(plan, options);
      // Hashing a large item takes time: recheck mapping and remote state immediately before the write.
      const ctx = await currentContext(plan);
      const remote = await readRemote(ctx, plan);
      options?.signal?.throwIfAborted();
      if (arrPath(remote.path) !== plan.newPath ||
          (plan.qualityProfileId != null && remote.qualityProfileId !== plan.qualityProfileId)) {
        const update = plan.mediaType === 'movie' ? ctx.service.updateMoviePath.bind(ctx.service) : ctx.service.updateSeriesPath.bind(ctx.service);
        await update(ctx.url, ctx.config.api_key, plan.remoteId, plan.newPath,
          { moveFiles: false, qualityProfileId: plan.qualityProfileId,
            expectedPath: remote.path, expectedProviderId: plan.providerId });
      }
      const confirmed = await readRemote(ctx, plan);
      if (arrPath(confirmed.path) !== plan.newPath ||
          (plan.qualityProfileId != null && confirmed.qualityProfileId !== plan.qualityProfileId)) {
        throw new Error('move_remote_update_unconfirmed');
      }
    },
  };
}
