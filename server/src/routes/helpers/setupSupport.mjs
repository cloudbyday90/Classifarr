/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

export function normalizeSetupMediaPath(rawPath) {
  return typeof rawPath === 'string' ? rawPath.trim() : '';
}

export function sendSetupErrorResponse(res, error) {
  const response = buildSettingsErrorResponse(error);
  return res.status(response.status).json(response.body);
}