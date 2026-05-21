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
import { createLogger } from '../utils/logger.mjs';
import { isBlank, sanitizeRuntimeSignature } from '../utils/stringUtils.mjs';
import { BaseIntegrityService } from '../utils/baseIntegrityService.mjs';

const logger = createLogger('discordConfigIntegrityService');

export const DISCORD_WARNING_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_STARTUP_SAMPLE_LIMIT = 10;

function buildIssue(issue, details = {}) {
  return {
    area: 'discord_notifications',
    issue,
    ...details,
  };
}

export function buildDiscordRuntimeDedupeKey(category, signature) {
  return [
    'discord-runtime',
    category || 'general',
    sanitizeRuntimeSignature(signature),
  ].join(':');
}

export class DiscordConfigIntegrityService extends BaseIntegrityService {
  constructor(deps = {}) {
    super(
      {
        db: deps.db || db,
        logger: deps.logger || logger,
        warningDedupeWindowMs: deps.warningDedupeWindowMs,
        startupSampleLimit: deps.startupSampleLimit,
      },
      DISCORD_WARNING_DEDUPE_WINDOW_MS,
      DEFAULT_STARTUP_SAMPLE_LIMIT
    );
  }

  warnRuntimeFailure({
    category = 'general',
    message,
    metadata = {},
    dedupeSignature = 'generic',
    dedupeWindowMs = this.warningDedupeWindowMs,
  } = {}) {
    this.logger.warn(
      message,
      {
        category,
        ...metadata,
      },
      {
        dedupeKey: buildDiscordRuntimeDedupeKey(category, dedupeSignature),
        dedupeWindowMs,
      }
    );
  }

  async auditPersistedConfigs({ source = 'startup_preflight' } = {}) {
    const result = await this.db.query(`
      SELECT id, enabled, bot_token, channel_id, notify_on_classification, notify_on_system_errors
      FROM notification_config
      WHERE type = 'discord'
      ORDER BY id
    `);

    const rows = Array.isArray(result.rows) ? result.rows : [];
    const enabledRows = rows.filter((row) => row.enabled === true);
    const issues = [];

    if (enabledRows.length > 1) {
      issues.push(buildIssue('multiple_enabled_rows', {
        enabledCount: enabledRows.length,
      }));
    }

    for (const row of enabledRows) {
      if (isBlank(row.bot_token)) {
        issues.push(buildIssue('missing_bot_token', { id: row.id }));
      }
      if (isBlank(row.channel_id)) {
        issues.push(buildIssue('missing_channel_id', { id: row.id }));
      }
    }

    const sample = issues.slice(0, this.startupSampleLimit);

    if (issues.length > 0) {
      this.logger.warn(
        'Persisted Discord notification configuration drift detected; Discord sends may warn once and be skipped until configuration is repaired',
        {
          source,
          invalidIssueCount: issues.length,
          issues: sample,
        },
        {
          dedupeKey: 'persisted-discord-config-drift',
          dedupeWindowMs: this.warningDedupeWindowMs,
        }
      );
    }

    return {
      invalidIssueCount: issues.length,
      issues: sample,
    };
  }
}

export const discordConfigIntegrityService = new DiscordConfigIntegrityService();
