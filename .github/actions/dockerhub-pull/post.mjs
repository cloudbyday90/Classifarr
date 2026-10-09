/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { logoutDockerHub } from '../../../scripts/lib/dockerHubPullAuth.mjs';

try { await logoutDockerHub(); }
catch {
  console.error('Docker Hub logout failed; discard this ephemeral runner.');
  process.exitCode = 1;
}
