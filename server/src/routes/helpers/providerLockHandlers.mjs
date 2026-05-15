/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildHeartbeatConfigResponse,
  normalizeProviderLockUpdatePayload,
} from './providerLockSettingsSupport.mjs';

export function createProviderLockHandlers({ providerLock }) {
  return {
    async getHeartbeatConfig(_req, res, next) {
      try {
        return res.json(buildHeartbeatConfigResponse(providerLock.config));
      } catch (error) {
        next(error);
      }
    },

    async updateHeartbeatConfig(req, res, next) {
      try {
        const normalizedUpdate = normalizeProviderLockUpdatePayload(req.body, providerLock.config);
        if (normalizedUpdate.error) {
          return res.status(400).json({
            error: normalizedUpdate.error,
          });
        }

        await providerLock.updateConfig(normalizedUpdate.payload);

        return res.json({ success: true });
      } catch (error) {
        next(error);
      }
    },

    async getProviderLockStatus(_req, res, next) {
      try {
        return res.json(providerLock.getLockStatus());
      } catch (error) {
        next(error);
      }
    },
  };
}
