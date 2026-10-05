/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import express from 'express';
import { router as authRouter } from '../routes/auth.mjs';
import { createBackupRouter } from '../routes/backupRouteShared.mjs';
import { authenticateToken, requireAdmin } from '../middleware/auth.mjs';
import { createRestoreApp } from './createRestoreApp.mjs';
import { refreshFromDatabase } from '../config/runtimeSettings.mjs';
import { createSelectedRestoreBackupFiles } from '../services/selectedRestoreBackupFiles.mjs';
import { createSelectedRestoreBackupService } from '../services/selectedRestoreBackupService.mjs';

/** No backupService, schema maintenance, normal bootstrap or worker imports. */
export async function startSelectedRestoreHttpServer({ database, handoff, environment = process.env, processRef = process }) {
  const preflight = await database.query(`SELECT current_user AS identity,
    to_regclass('public.policy_native_intent_reconciliation_restore_gates') AS gate_table,
    EXISTS(SELECT 1 FROM users WHERE role='admin') AS has_admin,
    (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
       OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
       OR has_schema_privilege(current_user,'public','CREATE')
       FROM pg_roles r WHERE rolname=current_user) AS privileged`);
  const row = preflight.rows[0];
  if (row?.identity !== 'cf_runtime' || row.privileged !== false || !row.gate_table || row.has_admin !== true) {
    throw new Error('selected_restore_http_preflight_failed');
  }
  await refreshFromDatabase();
  const service = createSelectedRestoreBackupService({
    files: createSelectedRestoreBackupFiles({ directory: environment.BACKUP_DIR }), handoff,
    audit: async (_operation, type, filename, _status, options) => database.query(
      `INSERT INTO backup_audit(operation,backup_type,filename,status,user_id,metadata)
       VALUES('import',$1,$2,'success',$3,'{"via":"restricted_handoff","keysPreserved":true}')`,
      [type, filename, options?.userId ?? null]),
  });
  const backupRouter = createBackupRouter({ express, backupService: service,
    authenticateToken, requireAdmin, logger: { info() {} },
    getRuntimeStatus: () => ({ mode: 'restore', restoreAllowed: true, restartRequired: true }),
  });
  const app = createRestoreApp({ database, authRouter, backupRouter });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(Number(environment.PORT), '0.0.0.0', () => resolve(listener));
    listener.once('error', reject);
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxConnections = 32;
  const stop = () => {
    handoff.close();
    const force = setTimeout(() => processRef.exit(1), 10_000); force.unref();
    server.close(() => { clearTimeout(force); processRef.exit(0); });
    server.closeIdleConnections();
  };
  processRef.once('SIGTERM', stop); processRef.once('SIGINT', stop);
  return server;
}
