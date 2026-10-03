/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertFixtureEnvironment, receipt } from './common.mjs';

if (process.argv[1] === '/app/src/index.mjs') {
  await assertFixtureEnvironment();
  // Arm only after the real application has acquired runtime admission and is
  // healthy. Restarted fixture tasks are not due until this seam is installed.
  process.once('SIGUSR2', () => {
    void import('./queueWorkload.mjs').then(module => module.installQueueWorkload())
      .catch(error => receipt('failure', { phase: 'queue_install', reason: String(error.message).slice(0, 300) }));
  });
}
