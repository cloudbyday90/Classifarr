/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  createArrConfigService,
  createArrConfigStatusService,
} from '../../services/arrConfigService.mjs';

export function createArrConfigHandlers({
  db,
  table,
  entityLabel,
  service,
  defaultPort,
  createDefaults = {},
  extraColumns = [],
}) {
  const arrConfigService = createArrConfigService({
    db,
    table,
    entityLabel,
    service,
    defaultPort,
    createDefaults,
    extraColumns,
  });

  return {
    async list(_req, res, next) {
      try {
        res.json(await arrConfigService.listConfigs());
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        res.json(await arrConfigService.createConfig(req.body));
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        res.json(await arrConfigService.updateConfig(req.params.id, req.body));
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        res.json(await arrConfigService.removeConfig(req.params.id));
      } catch (error) {
        next(error);
      }
    },

    async test(req, res, next) {
      try {
        res.json(await arrConfigService.testConfig(req.body));
      } catch (error) {
        next(error);
      }
    },

    async rootFolders(req, res, next) {
      try {
        res.json(await arrConfigService.getRootFolders(req.params.id));
      } catch (error) {
        next(error);
      }
    },

    async qualityProfiles(req, res, next) {
      try {
        res.json(await arrConfigService.getQualityProfiles(req.params.id));
      } catch (error) {
        next(error);
      }
    },
  };
}

export function createArrConfigStatusHandler({ db }) {
  const arrConfigStatusService = createArrConfigStatusService({ db });

  return async function getArrConfigStatus(_req, res, next) {
    try {
      res.json(await arrConfigStatusService.getIncompleteConfigs());
    } catch (error) {
      next(error);
    }
  };
}
