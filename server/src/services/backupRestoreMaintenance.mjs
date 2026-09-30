/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withBackupRestoreSession } from './backupRestoreSession.mjs';
import { executeBackupRestore } from './backupRestoreExecution.mjs';
import { NativeIntentReconciliationLifecycleService } from './nativeIntentReconciliationLifecycleService.mjs';
import { insertPolicyBackupRestoreVerification } from './policyBackupRestoreVerificationPersistence.mjs';

/** No HTTP listener, queue or scheduler. The owning process supplies its database identity. */
export async function runBackupRestoreMaintenance({ database, backupData, mode }) {
  const logger = { warn() {} };
  return withBackupRestoreSession({ database, logger }, async session => {
    await session.query("SET statement_timeout = '30s'");
    await session.query("SET lock_timeout = '5s'");
    await session.query("SET idle_in_transaction_session_timeout = '10s'");
    await session.query("SET transaction_timeout = '120s'");
    await session.query('SET search_path = public, pg_temp');
    await executeBackupRestore({
      database: session,
      lifecycle: new NativeIntentReconciliationLifecycleService({ db: session, loggerInstance: logger }),
      recordVerification: insertPolicyBackupRestoreVerification,
      backupData, mode, logger,
    });
    return { status: 'complete', reason: 'restore_verified', mode };
  });
}
