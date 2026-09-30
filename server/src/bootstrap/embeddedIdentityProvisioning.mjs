/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { planEmbeddedIdentity, readEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';

const execute = promisify(execFile);
const COMMANDS = Object.freeze({ groupmod: '/usr/sbin/groupmod', addgroup: '/usr/sbin/addgroup', usermod: '/usr/sbin/usermod' });

export async function provisionEmbeddedIdentity({
  environment = process.env, uid = process.getuid?.(), gid = process.getgid?.(),
  read = readFile, run = execute,
} = {}) {
  const accounts = async () => readEmbeddedAccounts(await read('/etc/passwd', 'utf8'), await read('/etc/group', 'utf8'));
  const plan = planEmbeddedIdentity({ environment, uid, gid, accounts: await accounts() });
  for (const [command, args] of plan.commands) {
    await run(COMMANDS[command], args, { cwd: '/', shell: false, timeout: 5000,
      killSignal: 'SIGKILL', maxBuffer: 16 * 1024, env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LC_ALL: 'C' } });
  }
  if (uid === 0) {
    const actual = (await accounts()).users.find(user => user.name === 'classifarr');
    if (actual?.uid !== plan.uid || actual?.gid !== plan.gid) throw new Error('embedded_identity_not_applied');
  }
  return { mode: plan.mode, uid: plan.uid, gid: plan.gid };
}
