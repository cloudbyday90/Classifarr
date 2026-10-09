/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { authenticateDockerHub } from '../../../scripts/lib/dockerHubPullAuth.mjs';

const controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
try {
  await authenticateDockerHub({ signal: controller.signal });
} catch (error) {
  const known = ['untrusted_context', 'credentials_missing', 'credentials_malformed',
    'conflicting_auth_override', 'credential_configuration_unreadable', 'cancelled'];
  if (known.includes(error?.message)) console.error(`Docker Hub preflight: ${error.message}`);
  // Other failure classifications are already reported. Never print raw exception text.
  console.error('Docker Hub pull authentication failed; review the sanitized diagnostics and credential setup.');
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
