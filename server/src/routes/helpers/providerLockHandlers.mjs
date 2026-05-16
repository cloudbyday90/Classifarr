/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import { sendData, sendSuccess } from '../../utils/responseHelpers.mjs';
import {
  buildHeartbeatConfigResponse,
  normalizeProviderLockUpdatePayload,
} from './providerLockSettingsSupport.mjs';

export function createProviderLockHandlers({ providerLock }) {
  return {
    getHeartbeatConfig: asyncHandler(async (_req, res) => sendData(res, buildHeartbeatConfigResponse(providerLock.config))),

    updateHeartbeatConfig: asyncHandler(async (req, res) => {
      const normalizedUpdate = normalizeProviderLockUpdatePayload(req.body, providerLock.config);
      if (normalizedUpdate.error) {
        throw new ValidationError(normalizedUpdate.error);
      }

      await providerLock.updateConfig(normalizedUpdate.payload);

      return sendSuccess(res);
    }),

    getProviderLockStatus: asyncHandler(async (_req, res) => sendData(res, providerLock.getLockStatus())),
  };
}
