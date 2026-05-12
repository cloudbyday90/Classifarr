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
    async list(_req, res) {
      try {
        res.json(await arrConfigService.listConfigs());
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async create(req, res) {
      try {
        res.json(await arrConfigService.createConfig(req.body));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async update(req, res) {
      try {
        res.json(await arrConfigService.updateConfig(req.params.id, req.body));
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
      }
    },

    async remove(req, res) {
      try {
        res.json(await arrConfigService.removeConfig(req.params.id));
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
      }
    },

    async test(req, res) {
      try {
        res.json(await arrConfigService.testConfig(req.body));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },

    async rootFolders(req, res) {
      try {
        res.json(await arrConfigService.getRootFolders(req.params.id));
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
      }
    },

    async qualityProfiles(req, res) {
      try {
        res.json(await arrConfigService.getQualityProfiles(req.params.id));
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  };
}

