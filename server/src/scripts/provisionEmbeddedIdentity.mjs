/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { provisionEmbeddedIdentity } from '../bootstrap/embeddedIdentityProvisioning.mjs';
import { embeddedStartupFailureMessage } from '../bootstrap/embeddedStartupPolicy.mjs';

if (import.meta.main) {
  try {
    if (process.platform !== 'linux' || process.argv.length !== 3 || process.argv[2] !== '--apply') {
      throw new Error('embedded_identity_invocation_invalid');
    }
    const identity = await provisionEmbeddedIdentity();
    process.stdout.write(`${JSON.stringify({ component: 'EmbeddedIdentity', ...identity })}\n`);
  } catch (error) {
    process.stderr.write(embeddedStartupFailureMessage(error));
    process.exitCode = 1;
  }
}
