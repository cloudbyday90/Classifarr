/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { types } from 'node:util';

// This file format is deliberately not a creator operation/append budget.
export const creationJournalLimits = Object.freeze({ records: 32, recordBytes: 65536, totalBytes: 524288 });
const fail = () => { throw new Error('creation_journal_invalid'); };
const hash = bytes => createHash('sha256').update(bytes).digest();
const keys = ['version', 'sequence', 'source', 'plan', 'kind', 'identity'];
function record(value, sequence, binding) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) fail();
  const row = {};
  for (const key of keys) {
    if (!descriptors[key] || !Object.hasOwn(descriptors[key], 'value')) fail();
    row[key] = descriptors[key].value;
  }
  if (row.version !== 1 || row.sequence !== sequence || typeof row.source !== 'string' || typeof row.plan !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.source) || !/^[a-f0-9]{64}$/.test(row.plan) || !['intent', 'identity', 'complete'].includes(row.kind) ||
    typeof row.identity !== 'string' || !/^fictional-[a-z0-9-]{1,64}$/.test(row.identity)) fail();
  if (binding && (row.source !== binding.source || row.plan !== binding.plan || row.identity !== binding.identity)) fail();
  return Object.freeze(row);
}

/** Private qualification format only: length LE32 + SHA256(payload) + UTF8 JSON + LF. */
export function encodeCreationJournalRecord(value) {
  if (types.isProxy(value)) fail();
  const sequence = Object.getOwnPropertyDescriptor(value ?? {}, 'sequence');
  if (!sequence || !Object.hasOwn(sequence, 'value') ||
    !Number.isSafeInteger(sequence.value) || sequence.value < 0 || sequence.value >= creationJournalLimits.records) fail();
  const payload = Buffer.from(JSON.stringify(record(value, sequence.value)), 'utf8');
  const frame = Buffer.alloc(37 + payload.length);
  if (frame.length > creationJournalLimits.recordBytes) fail();
  frame.writeUInt32LE(payload.length); hash(payload).copy(frame, 4); payload.copy(frame, 36); frame[frame.length - 1] = 10;
  return frame;
}

/** A valid prefix is evidence only; no completeness, native identity or retry authority. */
export function decodeCreationJournal(bytes, expected) {
  // Reconstruct the binding without consulting arbitrary getters/proxies.
  const binding = record(expected, 0);
  if (types.isProxy(bytes) || !Buffer.isBuffer(bytes) || bytes.length < 38 || bytes.length > creationJournalLimits.totalBytes) fail();
  const rows = []; let offset = 0;
  while (offset < bytes.length) {
    if (rows.length >= creationJournalLimits.records || bytes.length - offset < 37) fail();
    const size = bytes.readUInt32LE(offset), end = offset + size + 37;
    if (size < 1 || size + 37 > creationJournalLimits.recordBytes || end > bytes.length || bytes[end - 1] !== 10) fail();
    const payload = bytes.subarray(offset + 36, end - 1);
    if (!hash(payload).equals(bytes.subarray(offset + 4, offset + 36))) fail();
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)); } catch { fail(); }
    const row = record(value, rows.length, binding);
    // One canonical representation prevents duplicate fields, whitespace or byte aliases.
    if (!encodeCreationJournalRecord(row).equals(bytes.subarray(offset, end))) fail();
    rows.push(row); offset = end;
  }
  return Object.freeze(rows);
}
