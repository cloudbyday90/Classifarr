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
import { tmdbService } from './tmdb.mjs';
import { sonarrService } from './sonarr.mjs';
import { routingConfigIntegrityService } from './routingConfigIntegrityService.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  normalizeQualityProfileId,
  normalizeSettings,
  parseNonNegativeInteger,
  parsePositiveInteger,
} from './classificationRoutingServiceShared.mjs';
import { resolveDefaultQualityProfile, resolveDefaultRootFolder } from './classificationRoutingService.mjs';

const logger = createLogger('classificationRoutingSonarr');

const normalizeMonitor = (value) => {
  if (!value) {
    return 'all';
  }
  const key = value.toString();
  const map = {
    all_seasons: 'all',
    all: 'all',
    future: 'future',
    missing: 'missing',
    existing: 'existing',
    recent: 'recent',
    pilot: 'pilot',
    first: 'firstSeason',
    firstSeason: 'firstSeason',
    lastSeason: 'latestSeason',
    latest: 'latestSeason',
    latestSeason: 'latestSeason',
    none: 'none',
  };
  return map[key] || key;
};

export async function routeToSonarr(metadata, resolvedLibrary, routingResult) {
  const sonarrConfig = await db.query(
    'SELECT * FROM sonarr_config WHERE id = $1 AND is_active = true',
    [resolvedLibrary.arr_id],
  );

  if (sonarrConfig.rows.length === 0) {
    routingConfigIntegrityService.warnRoutingDrift({
      reasonCode: 'config_missing_or_inactive',
      library: resolvedLibrary,
      metadata,
      details: {
        arrType: 'sonarr',
        arrId: resolvedLibrary.arr_id,
      },
    });
    routingResult.reason = 'config_missing_or_inactive';
    return routingResult;
  }

  const config = sonarrConfig.rows[0];
  const baseUrl = config.url || sonarrService.buildUrl(config);
  const rawSettings = normalizeSettings(resolvedLibrary.sonarr_settings);
  const settings = Object.keys(rawSettings).length > 0
    ? rawSettings
    : {
      root_folder_path: resolvedLibrary.root_folder,
      quality_profile_id: resolvedLibrary.quality_profile_id,
      series_type: 'standard',
      season_monitoring: 'all',
      monitor_new_items: 'all',
      season_folder: true,
      search_on_add: true,
    };

  if (!settings.root_folder_path) {
    settings.root_folder_path = await resolveDefaultRootFolder('sonarr', baseUrl, config.api_key);
  }
  settings.quality_profile_id = normalizeQualityProfileId(settings.quality_profile_id);
  if (!settings.quality_profile_id) {
    settings.quality_profile_id = normalizeQualityProfileId(config.quality_profile_id);
  }
  if (!settings.quality_profile_id) {
    settings.quality_profile_id = await resolveDefaultQualityProfile('sonarr', baseUrl, config.api_key);
  }

  if (!settings.root_folder_path || !settings.quality_profile_id) {
    routingConfigIntegrityService.warnRoutingDrift({
      reasonCode: 'missing_required_settings',
      library: resolvedLibrary,
      metadata,
      details: {
        arrType: 'sonarr',
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

  let tvdbId = metadata.tvdb_id;
  if (!tvdbId && metadata.tmdb_id) {
    const externalIds = await tmdbService.getExternalIds(metadata.tmdb_id, 'tv');
    tvdbId = externalIds?.tvdb_id || externalIds?.tvdbId || null;
  }

  const normalizedTvdbId = parsePositiveInteger(tvdbId);
  if (!normalizedTvdbId) {
    logger.warn('Missing TVDB ID; skipping Sonarr routing', {
      title: metadata.title,
      tmdbId: metadata.tmdb_id,
    });
    routingResult.reason = 'missing_tvdb_id';
    return routingResult;
  }

  const lookupResults = await sonarrService.searchSeries(baseUrl, config.api_key, normalizedTvdbId);
  const lookupSeries = lookupResults.find((series) => parsePositiveInteger(series?.tvdbId) === normalizedTvdbId) || lookupResults[0];
  if (!lookupSeries) {
    logger.warn('Sonarr lookup returned no series', {
      title: metadata.title,
      tvdbId: normalizedTvdbId,
    });
    routingResult.reason = 'lookup_no_series';
    return routingResult;
  }
  if (!lookupSeries.title || !lookupSeries.title.toString().trim()) {
    logger.warn('Sonarr lookup missing English title; skipping add', {
      title: metadata.title,
      tvdbId: normalizedTvdbId,
    });
    routingResult.reason = 'lookup_missing_title';
    return routingResult;
  }

  const requestedSeasons = Array.isArray(metadata.requested_seasons)
    ? metadata.requested_seasons
        .map((season) => parseNonNegativeInteger(season))
        .filter((season) => season !== null)
    : [];
  const requestedSeasonSet = new Set(requestedSeasons);
  const includeSpecials = metadata.include_specials === true;
  const monitorValue = normalizeMonitor(settings.season_monitoring);

  const seriesData = {
    ...lookupSeries,
    qualityProfileId: settings.quality_profile_id,
    rootFolderPath: settings.root_folder_path,
    monitored: settings.monitor !== false,
    seriesType: settings.series_type || lookupSeries.seriesType || 'standard',
    seasonFolder: settings.season_folder !== false,
    tags: settings.tags || lookupSeries.tags || [],
    addOptions: {
      searchForMissingEpisodes: settings.search_on_add !== false,
      monitor: monitorValue || 'all',
    },
  };

  if (requestedSeasonSet.size > 0 && !includeSpecials) {
    requestedSeasonSet.delete(0);
  }

  if (Array.isArray(seriesData.seasons) && requestedSeasonSet.size > 0) {
    seriesData.seasons = seriesData.seasons.map((season) => {
      const seasonNumber = season?.seasonNumber ?? season?.season_number ?? season?.season ?? season?.number;
      const normalizedNumber = parseNonNegativeInteger(seasonNumber);
      let monitored = season?.monitored;

      if (normalizedNumber !== null) {
        monitored = requestedSeasonSet.has(normalizedNumber);
      }

      return {
        ...season,
        monitored,
      };
    });
  }

  delete seriesData.id;

  let existingSeries = null;
  try {
    existingSeries = await sonarrService.getSeriesByTvdbId(baseUrl, config.api_key, normalizedTvdbId);
  } catch (_error) {
    existingSeries = null;
  }

  if (existingSeries) {
    logger.info(`Series already in Sonarr library (pre-check): ${metadata.title}`, {
      sonarrId: existingSeries.id,
      tvdbId: normalizedTvdbId,
      monitored: existingSeries.monitored,
    });
    routingResult.routed = true;
    routingResult.reason = 'already_in_arr';
    return routingResult;
  }

  try {
    const addResult = await sonarrService.addSeries(baseUrl, config.api_key, seriesData);
    if (addResult?.alreadyExists) {
      logger.info(`Series already in Sonarr library (post-add 400/409): ${metadata.title}`);
      routingResult.routed = true;
      routingResult.reason = 'already_in_arr';
    } else {
      logger.info(`Added series to Sonarr: ${metadata.title}`);
      routingResult.routed = true;
      routingResult.reason = 'routed';
    }
    return routingResult;
  } catch (sonarrError) {
    logger.error('Failed to add series to Sonarr', {
      title: metadata.title,
      tvdbId: normalizedTvdbId,
      error: sonarrError.message,
      payload: {
        qualityProfileId: seriesData.qualityProfileId,
        rootFolderPath: seriesData.rootFolderPath,
        monitored: seriesData.monitored,
        seriesType: seriesData.seriesType,
        seasonFolder: seriesData.seasonFolder,
        addOptions: seriesData.addOptions,
      },
    });
    routingResult.reason = 'arr_add_failed';
    routingResult.error = sonarrError.message;
    return routingResult;
  }
}
