/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { types } from 'node:util';
import { SENSITIVE_FIELD_PATHS } from './logConfig.mjs';
import { isNativeError } from './nativeError.mjs';

const MAX_DEPTH = 8;
const MAX_VALUES = 1024;
const MAX_MEMBERS = 64;
const MAX_KEY_LENGTH = 128;
const MAX_STRING_LENGTH = 2048;
const MAX_BYTES = 64 * 1024;
const ROOT_FIELDS = new Set(['level', 'time', 'msg', 'pid', 'hostname', 'module']);
// Every recursive call reserves room for its own omission envelope. This also
// leaves enough space for a fixed marker before another child is inspected.
const ENVELOPE_RESERVE = 64;
const MIN_CHILD_BUDGET = 128;

function encodedBytes(value) {
  // Only primitives or our inert projection may reach JSON.stringify.
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function envelope(value, status) {
  const result = Object.create(null);
  result.logData = value;
  result.logDataStatus = status;
  return result;
}

function scalar(value, budget) {
  let bytes = encodedBytes(value);
  if (bytes > budget) { value = '[LogData:bytes]'; bytes = encodedBytes(value); }
  return { value, bytes };
}

function marker(category, budget) {
  return scalar(`[LogData:${category}]`, budget);
}

function visit(input, depth, budget, state) {
  state.values++;
  if (input === null || typeof input === 'boolean') return scalar(input, budget);
  if (typeof input === 'number') return scalar(Number.isFinite(input) ? (input === 0 ? 0 : input) : null, budget);
  if (typeof input === 'string') {
    // Do not turn a valid surrogate pair into invalid Unicode at the boundary.
    const end = input.charCodeAt(MAX_STRING_LENGTH - 1);
    const next = input.charCodeAt(MAX_STRING_LENGTH);
    const splitPair = end >= 0xd800 && end <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
    const value = input.length > MAX_STRING_LENGTH
      ? input.slice(0, MAX_STRING_LENGTH - (splitPair ? 1 : 0)) + '[LogData:string]'
      : input;
    return scalar(value, budget);
  }
  if (types.isProxy(input)) return marker('proxy', budget);
  if (typeof input !== 'object') return marker('unsupported', budget);
  if (isNativeError(input)) return marker('unsupported', budget);
  const array = Array.isArray(input);
  const prototype = Object.getPrototypeOf(input);
  if (!array && prototype !== null && prototype !== Object.prototype) return marker('unsupported', budget);
  if (state.ancestors.has(input)) return marker('cycle', budget);
  if (depth >= MAX_DEPTH) return marker('depth', budget);

  // Object.keys materializes an ordinary object's keys before our member cap.
  // This bounds retained traversal/output, not enumeration CPU/allocation.
  const keys = array ? null : Object.keys(input);
  const length = array ? Object.getOwnPropertyDescriptor(input, 'length').value : keys.length;
  const output = array ? Object.setPrototypeOf([], null) : Object.create(null);
  let bytes = 2;
  let retained = 0;
  let status = length > MAX_MEMBERS ? 'members' : null;
  state.ancestors.add(input);
  try {
    for (let index = 0; index < Math.min(length, MAX_MEMBERS); index++) {
      if (state.values >= MAX_VALUES) { status = 'values'; break; }
      const key = array ? String(index) : keys[index];
      if (key.length > MAX_KEY_LENGTH) { status = 'key'; continue; }
      const overhead = (retained ? 1 : 0) + (array ? 0 : encodedBytes(key) + 1);
      const available = budget - ENVELOPE_RESERVE - bytes - overhead;
      if (available < MIN_CHILD_BUDGET) { status = 'bytes'; break; }
      // Redact before looking at the descriptor, even for sensitive accessors.
      const sensitive = !array && SENSITIVE_FIELD_PATHS.some(field => key.toLowerCase().includes(field));
      const descriptor = sensitive ? null : Object.getOwnPropertyDescriptor(input, key);
      const value = sensitive ? '[REDACTED]'
        : !descriptor ? null // JSON array hole; never consult a prototype index.
          : Object.hasOwn(descriptor, 'value') ? descriptor.value : '[LogData:accessor]';
      const child = visit(value, depth + 1, available, state);
      output[key] = child.value;
      retained++;
      bytes += overhead + child.bytes;
    }
  } finally {
    state.ancestors.delete(input);
  }
  if (!status) return { value: output, bytes };
  const wrapped = envelope(output, status);
  return { value: wrapped, bytes: bytes + encodedBytes(envelope(null, status)) - 4 };
}

/**
 * Prepare logging-only data. Never serialize/coerce the source, invoke its
 * accessors or reflect on proxies. Native stack materialization is separate.
 * Limits cover the projection, not messages, bindings, request context or stacks.
 * @param {unknown} input
 * @returns {Record<string, unknown> | null | undefined} An inert merging record; absent/null stays absent/null.
 */
export function projectLogData(input) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  try {
    const projected = visit(input, 0, MAX_BYTES - ENVELOPE_RESERVE, { values: 0, ancestors: new WeakSet() }).value;
    const record = projected !== null && typeof projected === 'object' && !Array.isArray(projected);
    const conflict = record && Object.keys(projected).some(key => ROOT_FIELDS.has(key));
    const output = conflict ? envelope(projected, 'root_fields')
      : record ? projected : envelope(projected, 'root_value');
    // Defense against accounting mistakes; this never serializes original data.
    return encodedBytes(output) <= MAX_BYTES ? output : envelope('[LogData:bytes]', 'bytes');
  } catch {
    // No caught-value inspection and no recursive diagnostic logging.
    return envelope('[LogData:unavailable]', 'unavailable');
  }
}
