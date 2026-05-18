/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  DiscordConfigIntegrityService,
  buildDiscordRuntimeDedupeKey,
} from '../services/discordConfigIntegrityService.mjs';
import { createMockDb, createMockLogger } from './helpers/mockFactory.mjs';

describe('DiscordConfigIntegrityService', () => {
  test('buildDiscordRuntimeDedupeKey normalizes runtime signatures', () => {
    expect(buildDiscordRuntimeDedupeKey('channel_not_found', 'classification Missing Channel')).toBe(
      'discord-runtime:channel_not_found:classification_missing_channel'
    );
  });

  test('warnRuntimeFailure emits a deduped runtime warning', () => {
    const logger = createMockLogger();
    const service = new DiscordConfigIntegrityService({ db: createMockDb(), logger });

    service.warnRuntimeFailure({
      category: 'notification_skipped_not_initialized',
      message: 'Discord confidence-based notification skipped because the bot is not initialized',
      metadata: {
        isInitialized: false,
        hasClient: false,
      },
      dedupeSignature: 'false:false:confidence',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Discord confidence-based notification skipped because the bot is not initialized',
      expect.objectContaining({
        category: 'notification_skipped_not_initialized',
        isInitialized: false,
        hasClient: false,
      }),
      expect.objectContaining({
        dedupeKey: 'discord-runtime:notification_skipped_not_initialized:false:false:confidence',
      })
    );
  });

  test('auditPersistedConfigs warns once when enabled Discord config drift exists', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, enabled: true, bot_token: '', channel_id: '123', notify_on_classification: true, notify_on_system_errors: true },
        { id: 2, enabled: true, bot_token: 'discord-token', channel_id: '', notify_on_classification: true, notify_on_system_errors: true },
      ],
    });

    const service = new DiscordConfigIntegrityService({ db, logger, startupSampleLimit: 10 });
    const result = await service.auditPersistedConfigs({ source: 'startup_preflight' });

    expect(result.invalidIssueCount).toBe(3);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ issue: 'multiple_enabled_rows', enabledCount: 2 }),
      expect.objectContaining({ issue: 'missing_bot_token', id: 1 }),
      expect.objectContaining({ issue: 'missing_channel_id', id: 2 }),
    ]));
    expect(logger.warn).toHaveBeenCalledWith(
      'Persisted Discord notification configuration drift detected; Discord sends may warn once and be skipped until configuration is repaired',
      expect.objectContaining({
        source: 'startup_preflight',
        invalidIssueCount: 3,
      }),
      expect.objectContaining({
        dedupeKey: 'persisted-discord-config-drift',
      })
    );
  });

  test('auditPersistedConfigs stays quiet when Discord rows are absent or disabled', async () => {
    const db = createMockDb();
    const logger = createMockLogger();
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, enabled: false, bot_token: '', channel_id: '', notify_on_classification: true, notify_on_system_errors: true },
      ],
    });

    const service = new DiscordConfigIntegrityService({ db, logger });
    const result = await service.auditPersistedConfigs({ source: 'startup_preflight' });

    expect(result).toEqual({ invalidIssueCount: 0, issues: [] });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
