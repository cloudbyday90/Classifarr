/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function parseEmbeddedId(value) {
  if (!/^[1-9]\d{0,9}$/.test(String(value)) || String(Number(value)) !== String(value) || Number(value) > 2147483647) {
    throw new Error('embedded_identity_invalid');
  }
  return Number(value);
}

export function readEmbeddedAccounts(passwd, group) {
  const users = passwd.trim().split('\n').filter(Boolean).map(row => {
    const [name, , uid, gid] = row.split(':');
    return { name, uid: Number(uid), gid: Number(gid) };
  });
  const groups = group.trim().split('\n').filter(Boolean).map(row => {
    const [name, , gid] = row.split(':');
    return { name, gid: Number(gid) };
  });
  return { users, groups };
}

/** Plan first: invalid input or account collisions cannot leave partial mutations. */
export function planEmbeddedIdentity({ environment, uid, gid, accounts }) {
  const targetUid = parseEmbeddedId(environment.PUID || '1000');
  const targetGid = parseEmbeddedId(environment.PGID || '1000');
  const mask = environment.UMASK || '022';
  if (typeof mask !== 'string' || mask.trim() !== mask || !/^(?:0)?[0-7]{3}$/.test(mask)) throw new Error('embedded_umask_invalid');
  if (uid !== 0) {
    parseEmbeddedId(uid);
    parseEmbeddedId(gid);
    if (!accounts.users.some(user => user.uid === uid && user.name)) {
      throw new Error('embedded_nonroot_account_unavailable');
    }
    // Existing explicitly non-root containers cannot change their host-selected identity.
    return { mode: 'existing_nonroot', uid, gid, commands: [] };
  }
  const app = accounts.users.find(user => user.name === 'classifarr');
  const database = accounts.users.find(user => user.name === 'postgres');
  if (!app || !database || app.uid === 0 || database.uid === 0
    || targetUid === database.uid || targetGid === database.gid
    || accounts.users.some(user => user.uid === targetUid && user.name !== 'classifarr')) {
    throw new Error('embedded_identity_collision');
  }
  for (const value of [app.uid, app.gid, database.uid, database.gid]) parseEmbeddedId(value);
  const commands = [];
  const targetGroup = accounts.groups.find(group => group.gid === targetGid);
  if (!targetGroup) {
    commands.push(accounts.groups.some(group => group.name === 'classifarr')
      ? ['groupmod', ['-g', String(targetGid), 'classifarr']]
      : ['addgroup', ['-g', String(targetGid), 'classifarr']]);
  }
  if (app.uid !== targetUid || app.gid !== targetGid) {
    commands.push(['usermod', ['-u', String(targetUid), '-g', String(targetGid), 'classifarr']]);
  }
  return { mode: 'configured_root', uid: targetUid, gid: targetGid, commands };
}
