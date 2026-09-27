/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import * as db from '../config/database.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { classificationEvidenceRepository } from './classificationEvidenceRepository.mjs';
import { readBackupConfiguration } from './backupExportCatalog.mjs';

export async function collectBackupSnapshot({ includePatterns = true } = {}) {
  return db.withTransaction(async client => {
    // Must precede the first data query. All readers share this connection.
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    await client.query("SET LOCAL transaction_timeout = '120s'");

    const { data, meta } = await readBackupConfiguration(client);
    if (includePatterns) {
      data.learningPatterns = await classificationEvidenceService.listLegacyPatterns({ client });
      meta.learningPatternsCount = data.learningPatterns.length;
      data.classificationEvidence = await classificationEvidenceRepository.listAll({ client });
      meta.classificationEvidenceCount = data.classificationEvidence.length;
    }
    // Do not expose partial results or perform file I/O before commit succeeds.
    return { version: '2.0', exportedAt: new Date().toISOString(), data, meta };
  });
}
