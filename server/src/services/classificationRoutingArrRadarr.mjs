/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { radarrService } from './radarr.mjs';
import { routingConfigIntegrityService } from './routingConfigIntegrityService.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  normalizeQualityProfileId,
  normalizeSettings,
  parsePositiveInteger,
} from './classificationRoutingServiceShared.mjs';
import { resolveDefaultQualityProfile, resolveDefaultRootFolder } from './classificationRoutingService.mjs';

const logger = createLogger('classificationRoutingRadarr');

export async function routeToRadarr(metadata, resolvedLibrary, routingResult) {
  const radarrConfig = await db.query(
    'SELECT * FROM radarr_config WHERE id = $1 AND is_active = true',
    [resolvedLibrary.arr_id],
  );

  if (radarrConfig.rows.length === 0) {
    routingConfigIntegrityService.warnRoutingDrift({
      reasonCode: 'config_missing_or_inactive',
      library: resolvedLibrary,
      metadata,
      details: {
        arrType: 'radarr',
        arrId: resolvedLibrary.arr_id,
      },
    });
    routingResult.reason = 'config_missing_or_inactive';
    return routingResult;
  }

  const config = radarrConfig.rows[0];
  const baseUrl = config.url || radarrService.buildUrl(config);
  const rawSettings = normalizeSettings(resolvedLibrary.radarr_settings);
  const settings = Object.keys(rawSettings).length > 0
    ? rawSettings
    : {
      root_folder_path: resolvedLibrary.root_folder,
      quality_profile_id: resolvedLibrary.quality_profile_id,
      monitor: true,
      search_on_add: true,
    };

  if (!settings.root_folder_path) {
    settings.root_folder_path = await resolveDefaultRootFolder('radarr', baseUrl, config.api_key);
  }
  settings.quality_profile_id = normalizeQualityProfileId(settings.quality_profile_id);
  if (!settings.quality_profile_id) {
    settings.quality_profile_id = normalizeQualityProfileId(config.quality_profile_id);
  }
  if (!settings.quality_profile_id) {
    settings.quality_profile_id = await resolveDefaultQualityProfile('radarr', baseUrl, config.api_key);
  }

  if (!settings.root_folder_path || !settings.quality_profile_id) {
    routingConfigIntegrityService.warnRoutingDrift({
      reasonCode: 'missing_required_settings',
      library: resolvedLibrary,
      metadata,
      details: {
        arrType: 'radarr',
        arrId: resolvedLibrary.arr_id,
        missingFields: [
          !settings.root_folder_path ? 'root_folder_path' : null,
          !settings.quality_profile_id ? 'quality_profile_id' : null,
        ].filter(Boolean),
      },
    });
    routingResult.reason = 'missing_required_settings';
    return routingResult;
  }

  const normalizedYear = parsePositiveInteger(metadata.year);
  const movieData = {
    title: metadata.title,
    tmdbId: metadata.tmdb_id,
    ...(normalizedYear !== null ? { year: normalizedYear } : {}),
    qualityProfileId: settings.quality_profile_id,
    rootFolderPath: settings.root_folder_path,
    monitored: settings.monitor !== false,
    minimumAvailability: settings.minimum_availability || 'released',
    tags: settings.tags || [],
    addOptions: {
      searchForMovie: settings.search_on_add !== false,
    },
  };

  let existingMovie = null;
  if (metadata.tmdb_id) {
    try {
      existingMovie = await radarrService.getMovieByTmdbId(baseUrl, config.api_key, metadata.tmdb_id);
    } catch (_error) {
      existingMovie = null;
    }
  }

  if (existingMovie) {
    logger.info(`Movie already in Radarr library (pre-check): ${metadata.title}`, {
      radarrId: existingMovie.id,
      tmdbId: metadata.tmdb_id,
      monitored: existingMovie.monitored,
    });
    routingResult.routed = true;
    routingResult.reason = 'already_in_arr';
    return routingResult;
  }

  const addResult = await radarrService.addMovie(baseUrl, config.api_key, movieData);
  if (addResult?.alreadyExists) {
    logger.info(`Movie already in Radarr library (post-add 400/409): ${metadata.title}`);
    routingResult.routed = true;
    routingResult.reason = 'already_in_arr';
  } else {
    logger.info(`Added movie to Radarr: ${metadata.title}`);
    routingResult.routed = true;
    routingResult.reason = 'routed';
  }
  return routingResult;
}
