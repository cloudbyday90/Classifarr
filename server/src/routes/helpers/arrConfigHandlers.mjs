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
      res.json(await arrConfigService.listConfigs());
    },

    async create(req, res) {
      res.json(await arrConfigService.createConfig(req.body));
    },

    async update(req, res) {
      res.json(await arrConfigService.updateConfig(req.params.id, req.body));
    },

    async remove(req, res) {
      res.json(await arrConfigService.removeConfig(req.params.id));
    },

    async test(req, res) {
      res.json(await arrConfigService.testConfig(req.body));
    },

    async rootFolders(req, res) {
      res.json(await arrConfigService.getRootFolders(req.params.id));
    },

    async qualityProfiles(req, res) {
      res.json(await arrConfigService.getQualityProfiles(req.params.id));
    },
  };
}

export function createArrConfigStatusHandler({ db }) {
  const arrConfigStatusService = createArrConfigStatusService({ db });

  return async function getArrConfigStatus(_req, res) {
    res.json(await arrConfigStatusService.getIncompleteConfigs());
  };
}
