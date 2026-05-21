/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const DEFAULT_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_STARTUP_SAMPLE_LIMIT = 10;

export class BaseIntegrityService {
  constructor(deps, defaultWindowMs, defaultSampleLimit) {
    this.db = deps.db;
    this.logger = deps.logger;
    this.warningDedupeWindowMs = Number.isFinite(Number(deps.warningDedupeWindowMs))
      ? Number(deps.warningDedupeWindowMs)
      : defaultWindowMs;
    this.startupSampleLimit = Number.isFinite(Number(deps.startupSampleLimit))
      ? Number(deps.startupSampleLimit)
      : defaultSampleLimit;
  }

  _emitWarn(message, data = {}, dedupeKey) {
    this.logger.warn(message, data, {
      dedupeKey,
      dedupeWindowMs: this.warningDedupeWindowMs,
    });
  }
}
