/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as fs from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { assessVmHandoff, unavailableVmHandoff, VM_HANDOFF_BYTES } from './gatewayVmHandoff.mjs';
import { isVmGuid } from './gatewayVmPreparation.mjs';

const sameFile = (a, b) => ['dev', 'ino', 'mode', 'nlink', 'uid', 'gid', 'size', 'mtimeMs', 'ctimeMs'].every(key => a[key] === b[key]);

/** Read-only local input. Windows ACL review remains manual; no SSH/host query is invoked. */
export function assessVmHandoffFile({ file, vmId, switchId }, { io = fs, platform = process.platform, uid = process.getuid?.() } = {}) {
  if (!isVmGuid(vmId) || !isVmGuid(switchId)) throw new Error('gateway_vm_arguments_invalid');
  let fd, result = unavailableVmHandoff();
  try {
    if (typeof file !== 'string' || file.length > 2048 || !isAbsolute(file) || /[\0\r\n]/.test(file)
      || /^[/\\]{2}/.test(file) || platform === 'win32' && file.slice(2).includes(':')) throw new Error();
    const path = resolve(file), before = io.lstatSync(path);
    if (io.realpathSync(path) !== path || !before.isFile() || before.isSymbolicLink() || before.nlink !== 1
      || before.size < 1 || before.size > VM_HANDOFF_BYTES
      || platform !== 'win32' && (!Number.isSafeInteger(uid) || before.uid !== uid || (before.mode & 0o077) !== 0)) throw new Error();
    fd = io.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    if (!sameFile(before, io.fstatSync(fd))) throw new Error();
    const bytes = Buffer.alloc(VM_HANDOFF_BYTES + 1);
    let total = 0, count;
    while (total < bytes.length && (count = io.readSync(fd, bytes, total, bytes.length - total, total)) > 0) total += count;
    if (total !== before.size || total > VM_HANDOFF_BYTES || !sameFile(before, io.fstatSync(fd))
      || !sameFile(before, io.lstatSync(path)) || io.realpathSync(path) !== path) throw new Error();
    result = assessVmHandoff(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, total)), { vmId, switchId });
  } catch { /* Fixed unavailable output, never raw paths, contents or errors. */ }
  finally {
    if (fd !== undefined) { try { io.closeSync(fd); } catch { result = unavailableVmHandoff(); } }
  }
  return { ...result, unixFileModeChecked: result.status === 'matched' && platform !== 'win32' };
}
