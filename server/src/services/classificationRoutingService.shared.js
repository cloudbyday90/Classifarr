/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const db = require('../config/database');
const tmdbService = require('./tmdb');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const { createLogger } = require('../utils/logger');
const sharedHelpers = require('./classificationRoutingServiceShared');

const {
  ensureDecisionQuestion,
  isSettingsEmpty,
  normalizeQualityProfileId,
  normalizeSettings,
  parseNonNegativeInteger,
  parsePositiveInteger,
  suggestSeriesType,
} = sharedHelpers;

const logger = createLogger('classificationRoutingService');

async function resolveDefaultQualityProfile(arrType, baseUrl, apiKey) {
  try {
    const cached = await db.query(
      `SELECT profile_id
       FROM arr_profiles_cache
       WHERE arr_type = $1 AND profile_type = 'quality_profile'
       ORDER BY last_synced DESC, profile_id ASC
       LIMIT 1`,
      [arrType],
    );
    if (cached.rows.length > 0) {
      return cached.rows[0].profile_id;
    }

    const profiles = arrType === 'radarr'
      ? await radarrService.getQualityProfiles(baseUrl, apiKey)
      : await sonarrService.getQualityProfiles(baseUrl, apiKey);
    return profiles?.[0]?.id || null;
  } catch (error) {
    logger.warn('Failed to resolve default quality profile', { arrType, error: error.message });
    return null;
  }
}

async function resolveDefaultRootFolder(arrType, baseUrl, apiKey) {
  try {
    const cached = await db.query(
      `SELECT profile_path
       FROM arr_profiles_cache
       WHERE arr_type = $1 AND profile_type = 'root_folder'
       ORDER BY last_synced DESC, profile_id ASC
       LIMIT 1`,
      [arrType],
    );
    if (cached.rows.length > 0) {
      return cached.rows[0].profile_path;
    }

    const folders = arrType === 'radarr'
      ? await radarrService.getRootFolders(baseUrl, apiKey)
      : await sonarrService.getRootFolders(baseUrl, apiKey);
    return folders?.[0]?.path || null;
  } catch (error) {
    logger.warn('Failed to resolve default root folder', { arrType, error: error.message });
    return null;
  }
}

async function resolveRoutingConfig(library) {
  if (!library) {
    return null;
  }

  const libraryId = library.id || library.library_id || null;
  const resolved = {
    ...library,
    id: library.id || library.library_id,
    library_id: library.library_id || library.id,
  };

  const needsMapping = !resolved.arr_id || !resolved.arr_type;
  if (!needsMapping || !libraryId) {
    return resolved;
  }

  const mappingResult = await db.query(
    'SELECT * FROM library_arr_mappings WHERE library_id = $1',
    [libraryId],
  );

  if (mappingResult.rows.length === 0) {
    return resolved;
  }

  const mapping = mappingResult.rows[0];

  resolved.arr_type = resolved.arr_type || mapping.arr_type;
  resolved.arr_id = resolved.arr_id || mapping.arr_config_id;
  resolved.root_folder = resolved.root_folder || mapping.arr_root_folder_path;
  resolved.quality_profile_id = resolved.quality_profile_id || mapping.quality_profile_id;

  if (mapping.arr_type === 'radarr' && isSettingsEmpty(resolved.radarr_settings)) {
    resolved.radarr_settings = {
      root_folder_path: mapping.arr_root_folder_path,
      quality_profile_id: mapping.quality_profile_id,
      monitor: true,
      search_on_add: true,
    };
  }

  if (mapping.arr_type === 'sonarr' && isSettingsEmpty(resolved.sonarr_settings)) {
    resolved.sonarr_settings = {
      root_folder_path: mapping.arr_root_folder_path,
      quality_profile_id: mapping.quality_profile_id,
      series_type: 'standard',
      season_monitoring: 'all',
      season_folder: true,
      search_on_add: true,
    };
  }

  return resolved;
}

async function routeToArr(metadata, library) {
  const routingResult = {
    attempted: false,
    routed: false,
    arrType: null,
    reason: null,
    error: null,
  };

  try {
    const resolvedLibrary = await resolveRoutingConfig(library);

    if (!resolvedLibrary || !resolvedLibrary.arr_type) {
      logger.warn('No *arr mapping available for routing', {
        title: metadata.title,
        libraryId: library?.id || library?.library_id || null,
      });
      routingResult.reason = 'no_mapping';
      return routingResult;
    }

    routingResult.arrType = resolvedLibrary.arr_type;

    if (!resolvedLibrary.arr_id) {
      logger.warn('Missing *arr config ID; routing skipped', {
        title: metadata.title,
        libraryId: resolvedLibrary.id || resolvedLibrary.library_id || null,
        arr_type: resolvedLibrary.arr_type,
      });
      routingResult.reason = 'missing_arr_id';
      return routingResult;
    }

    routingResult.attempted = true;

    if (resolvedLibrary.arr_type === 'radarr') {
      const radarrConfig = await db.query(
        'SELECT * FROM radarr_config WHERE id = $1 AND is_active = true',
        [resolvedLibrary.arr_id],
      );

      if (radarrConfig.rows.length === 0) {
        logger.warn('Radarr config missing or inactive; routing skipped', {
          title: metadata.title,
          arr_id: resolvedLibrary.arr_id,
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
        logger.warn('Missing Radarr routing settings; skipping route', {
          title: metadata.title,
          root_folder_path: settings.root_folder_path || null,
          quality_profile_id: settings.quality_profile_id || null,
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

    if (resolvedLibrary.arr_type === 'sonarr') {
      const sonarrConfig = await db.query(
        'SELECT * FROM sonarr_config WHERE id = $1 AND is_active = true',
        [resolvedLibrary.arr_id],
      );

      if (sonarrConfig.rows.length === 0) {
        logger.warn('Sonarr config missing or inactive; routing skipped', {
          title: metadata.title,
          arr_id: resolvedLibrary.arr_id,
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
        logger.warn('Missing Sonarr routing settings; skipping route', {
          title: metadata.title,
          root_folder_path: settings.root_folder_path || null,
          quality_profile_id: settings.quality_profile_id || null,
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

    routingResult.reason = 'unsupported_arr_type';
    return routingResult;
  } catch (error) {
    logger.error('Failed to route to arr', { error: error.message });
    routingResult.error = error.message;
    routingResult.reason = routingResult.reason || 'unexpected_error';
    return routingResult;
  }
}

const classificationRoutingService = {
  ensureDecisionQuestion,
  isSettingsEmpty,
  normalizeQualityProfileId,
  normalizeSettings,
  resolveDefaultQualityProfile,
  resolveDefaultRootFolder,
  resolveRoutingConfig,
  routeToArr,
  suggestSeriesType,
};

module.exports = classificationRoutingService;
module.exports.ensureDecisionQuestion = ensureDecisionQuestion;
module.exports.isSettingsEmpty = isSettingsEmpty;
module.exports.normalizeQualityProfileId = normalizeQualityProfileId;
module.exports.normalizeSettings = normalizeSettings;
module.exports.resolveDefaultQualityProfile = resolveDefaultQualityProfile;
module.exports.resolveDefaultRootFolder = resolveDefaultRootFolder;
module.exports.resolveRoutingConfig = resolveRoutingConfig;
module.exports.routeToArr = routeToArr;
module.exports.suggestSeriesType = suggestSeriesType;
module.exports.default = classificationRoutingService;
