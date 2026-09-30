/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { ValidationError } from '../utils/appError.mjs';
import { restoreAllTables } from './backupRestore.mjs';

/** Execute only inside the pinned restore-owner session, never the global pool. */
export async function executeBackupRestore({ database, lifecycle, recordVerification, backupData, mode, logger, createSystemApiKey = null }) {
  const attempt = await lifecycle.beginBackupRestore({ dbClient: database, sessionOwned: true });
  if (!attempt.started) {
    throw new ValidationError(
      'A backup restore is already in progress. Wait for it to finish before retrying. If a prior process stopped, its legacy restore gate requires operator investigation.',
    );
  }

  try {
    const restoreResult = await database.withTransaction(client => restoreAllTables(client, backupData, mode, { createSystemApiKey }));
    const verification = await lifecycle.verifyRestoredDatabase({ dbClient: database });
    const completion = await database.withTransaction(async client => {
      const completedRestore = await lifecycle.completeBackupRestore({
        dbClient: client, restoreToken: attempt.restoreToken, verification,
      });
      if (!completedRestore.completed) return completedRestore;
      await recordVerification({
        db: client,
        restoreMode: mode,
        backupVersion: backupData.version,
        verification,
        verifiedAt: completedRestore.verifiedAt,
      });
      return completedRestore;
    });
    if (!completion.completed) {
      throw new ValidationError(
        'Backup restore completed but native policy authority validation did not pass. Maintenance is required before reconciliation can run.',
      );
    }
    return {
      ...restoreResult,
      reconciliationRestore: { statusId: 'verified', rawPayloadExposed: false },
    };
  } catch (error) {
    try {
      await lifecycle.failBackupRestore({ dbClient: database, restoreToken: attempt.restoreToken });
    } catch {
      logger.warn('Restore failed and its failure gate could not be recorded',
        { reasonId: 'restore_failure_recording_unavailable' }, { skipDbPersist: true });
    }
    throw error;
  }
}
