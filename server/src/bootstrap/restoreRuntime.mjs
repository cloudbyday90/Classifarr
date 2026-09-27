/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { router as authRouter } from '../routes/auth.mjs';
import { router as backupRouter } from '../routes/backup.mjs';
import { createRestoreApp } from './createRestoreApp.mjs';
import { refreshFromDatabase } from '../config/runtimeSettings.mjs';

export async function startRestoreServer({ database, port = process.env.PORT || 21324, processRef = process }) {
  // Read-only preflight: never start normal migrations, repair tasks or providers here.
  const result = await database.query(`SELECT
    to_regclass('public.policy_native_intent_reconciliation_restore_gates') AS gate_table,
    EXISTS (SELECT 1 FROM users WHERE role = 'admin') AS has_admin`);
  if (!result.rows[0]?.gate_table || result.rows[0]?.has_admin !== true) {
    throw new Error('Restore mode requires an initialized database and an existing administrator. Complete normal setup first.');
  }
  await refreshFromDatabase();
  const app = createRestoreApp({ database, authRouter, backupRouter });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, '0.0.0.0', () => resolve(listener));
    listener.once('error', reject);
  });
  const stop = () => {
    // Process exit also ends any pinned restore session; no unverified auto-resume.
    const force = setTimeout(() => processRef.exit(1), 10_000);
    force.unref();
    server.close(() => { clearTimeout(force); processRef.exit(0); });
  };
  processRef.once('SIGTERM', stop);
  processRef.once('SIGINT', stop);
  return server;
}
