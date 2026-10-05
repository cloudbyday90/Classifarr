/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { readEmbeddedAccounts, requireSeparatedEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';
import { readSelectedVerificationRequest, selectedVerificationEnvironment } from './selectedVerificationHandoff.mjs';
import { verifySelectedMigration } from './selectedMigrationVerification.mjs';

export async function runSelectedVerificationBootstrap({ stream, signal, environment = process.env,
  context = { platform: process.platform, uid: process.getuid?.(), cwd: process.cwd(), args: process.argv.slice(2), umask: process.umask() },
  accounts = async () => readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')),
  verify = verifySelectedMigration,
}) {
  const expected = selectedVerificationEnvironment();
  if (context.platform !== 'linux' || context.uid !== 0 || context.cwd !== '/app'
    || context.args.length !== 1 || context.args[0] !== '--verify'
    || Object.keys(environment).length !== Object.keys(expected).length
    || Object.entries(expected).some(([key, value]) => environment[key] !== value)) {
    throw new Error('selected_verification_boundary_invalid');
  }
  const { request, profile } = await readSelectedVerificationRequest(stream, { signal });
  const { application } = requireSeparatedEmbeddedAccounts(await accounts());
  if (application.uid !== profile.supervisor.uid || application.gid !== profile.supervisor.gid
    || context.umask !== Number.parseInt(profile.supervisor.umask, 8)) throw new Error('selected_verification_identity_invalid');
  signal?.throwIfAborted();
  await verify({ expectedSystemId: request.expectedSystemId, signal, timeoutMs: profile.supervisor.databaseStartupTimeoutMs });
}
