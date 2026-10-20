/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as fs from 'node:fs';
import { isVmGuid } from './gatewayVmPreparation.mjs';

const devices = '/sys/bus/vmbus/devices';
const shutdownClass = '{0e0b6031-5213-4934-818b-38d90ced39db}\n';
const driver = '/sys/bus/vmbus/drivers/hv_utils';
export const VM_SHUTDOWN_DEVICE_LIMIT = 128;

function inventory(io) {
  const dir = io.opendirSync(devices), names = [];
  try {
    let item;
    while ((item = dir.readSync()) !== null) {
      if (names.length === VM_SHUTDOWN_DEVICE_LIMIT || !isVmGuid(item.name) || names.includes(item.name)) throw new Error();
      names.push(item.name);
    }
  } finally { dir.closeSync(); }
  return names.sort();
}

function classId(io, name) {
  const fd = io.openSync(`${devices}/${name}/class_id`, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
  try {
    // sysfs emits exactly a braced GUID and LF. One extra byte detects oversize.
    const bytes = Buffer.alloc(40);
    let total = 0, count;
    while (total < bytes.length && (count = io.readSync(fd, bytes, total, bytes.length - total, total)) > 0) total += count;
    const text = bytes.subarray(0, total).toString('utf8');
    if (total !== 39 || text[0] !== '{' || text.slice(37) !== '}\n' || !isVmGuid(text.slice(1, 37))) throw new Error();
    return text;
  } finally { io.closeSync(fd); }
}

function snapshot(io) {
  return inventory(io).map(name => {
    const type = classId(io, name);
    return { name, type, binding: type === shutdownClass ? io.realpathSync(`${devices}/${name}/driver`) : null };
  });
}

/** Guest-local observation only: binding is not protocol negotiation or successful shutdown. */
export function captureGuestShutdown({ io = fs, platform = process.platform } = {}) {
  let status = 'unavailable';
  if (platform === 'linux') {
    try {
      const first = snapshot(io), second = snapshot(io);
      if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error();
      const matches = second.filter(row => row.type === shutdownClass);
      if (matches.length > 1) throw new Error();
      status = matches.length === 1 && matches[0].binding === driver ? 'matched' : 'mismatch';
    } catch { /* Missing, unreadable, changing or unsupported sysfs is not a match. */ }
  }
  return { check: 'guest_shutdown_channel_bound', status };
}
