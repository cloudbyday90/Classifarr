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
import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

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
    async list(_req, res) {
      try {
        res.json(await arrConfigService.listConfigs());
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async create(req, res) {
      try {
        res.json(await arrConfigService.createConfig(req.body));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async update(req, res) {
      try {
        res.json(await arrConfigService.updateConfig(req.params.id, req.body));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async remove(req, res) {
      try {
        res.json(await arrConfigService.removeConfig(req.params.id));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async test(req, res) {
      try {
        res.json(await arrConfigService.testConfig(req.body));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        res.status(response.status).json(response.body);
      }
    },

    async rootFolders(req, res) {
      try {
        res.json(await arrConfigService.getRootFolders(req.params.id));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async qualityProfiles(req, res) {
      try {
        res.json(await arrConfigService.getQualityProfiles(req.params.id));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },
  };
}

export function createArrConfigStatusHandler({ db }) {
  const arrConfigStatusService = createArrConfigStatusService({ db });

  return async function getArrConfigStatus(_req, res) {
    try {
      res.json(await arrConfigStatusService.getIncompleteConfigs());
    } catch (error) {
      const response = buildSettingsErrorResponse(error);
      res.status(response.status).json(response.body);
    }
  };
}

