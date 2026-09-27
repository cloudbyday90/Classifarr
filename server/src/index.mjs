/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { enableCompileCache } from 'node:module';
import * as database from './config/database.mjs';
import { startApplication } from './bootstrap/startApplication.mjs';

enableCompileCache();

if (import.meta.main) {
  try {
    await startApplication({
      database,
      onAdmissionLost: () => {
        // eslint-disable-next-line no-console -- fail-stop rather than reconnecting without ownership
        console.error('Runtime database ownership lost; stopping all work.');
        // eslint-disable-next-line n/no-process-exit -- stop background writers at the entrypoint
        process.exit(1);
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console -- fatal diagnostic before normal runtime exists
    console.error('Failed to start server:', error.message);
    // eslint-disable-next-line n/no-process-exit -- do not leave imported workers alive
    process.exit(1);
  }
}
