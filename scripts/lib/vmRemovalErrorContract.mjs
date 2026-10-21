/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isProxy } from 'node:util/types';

export const removalErrorLimits = Object.freeze({ nodes: 6, secondary: 4, bytes: 32768, idCharacters: 2048 });
const kinds = ['exception', 'system', 'invalid_operation', 'runtime', 'parent_record', 'parameter_binding', 'win32', 'io', 'access_denied', 'other'];
const ids = ['none', 'other', 'oversize', 'strict_property', 'strict_variable'];
const phases = ['projection', 'journal', 'dispose'];
const flags = ['truncated', 'cycle', 'unsupported', 'projectionFailed'];
const invalid = () => { throw new Error('vm_removal_error_invalid'); };
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const nullableBoolean = v => v === null || typeof v === 'boolean';

// Inspect only own data fields. Do not enumerate extras, invoke accessors or accept proxies.
function field(value, key, arrayField = false) {
  if (!value || typeof value !== 'object' || isProxy(value)) return invalid();
  const proto = Object.getPrototypeOf(value);
  if ((!arrayField && Array.isArray(value)) || (proto !== null && proto !== (arrayField ? Array.prototype : Object.prototype))) return invalid();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return invalid();
  return descriptor.value;
}
function array(value, max) {
  if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) return invalid();
  const length = field(value, 'length', true);
  if (!integer(length, 0, max)) return invalid();
  return Array.from({ length }, (_, index) => field(value, String(index), true));
}

function detail(value) {
  const status = field(value, 'status');
  const category = field(value, 'category');
  const errorId = field(value, 'errorId');
  const detailsPresent = field(value, 'detailsPresent');
  const targetPresent = field(value, 'targetPresent');
  if (!['none', 'captured', 'partial', 'unavailable'].includes(status)
    || !(category === null || integer(category, 0, 63)) || !(errorId === null || ids.includes(errorId))
    || !nullableBoolean(detailsPresent) || !nullableBoolean(targetPresent)) return invalid();
  const observedFlags = Object.fromEntries(flags.map(key => [key, field(value, key)]));
  if (Object.values(observedFlags).some(v => typeof v !== 'boolean')) return invalid();
  const nodes = array(field(value, 'nodes'), removalErrorLimits.nodes).map((node, index) => {
    const kind = field(node, 'kind'); const via = field(node, 'via'); const parent = field(node, 'parent');
    const hresult = field(node, 'hresult'); const nativeErrorCode = field(node, 'nativeErrorCode');
    if (!kinds.includes(kind) || !integer(hresult, -2147483648, 2147483647)
      || !(nativeErrorCode === null || (kind === 'win32' && integer(nativeErrorCode, -2147483648, 2147483647)))
      || (kind === 'win32' && nativeErrorCode === null)
      || (index === 0 ? via !== 'root' || parent !== null
        : !['inner', 'record'].includes(via) || !integer(parent, 0, index - 1))) return invalid();
    return { kind, via, parent, hresult, nativeErrorCode };
  });
  const incomplete = Object.values(observedFlags).some(Boolean);
  if ((errorId === 'oversize' && !observedFlags.truncated)
    || (nodes.some(node => node.kind === 'parent_record') && !observedFlags.unsupported)) return invalid();
  if (status === 'none' && (category !== null || errorId !== null || detailsPresent !== null || targetPresent !== null || nodes.length || incomplete)) return invalid();
  if (status === 'captured' && (incomplete || !nodes.length || category === null || errorId === null || detailsPresent === null || targetPresent === null)) return invalid();
  if (status === 'partial' && (!incomplete || !nodes.length)) return invalid();
  if (status === 'unavailable' && (!incomplete || nodes.length)) return invalid();
  return { status, category, errorId, detailsPresent, targetPresent, nodes, ...observedFlags };
}

/** Accept a JSON-like projected DTO, never a raw PowerShell or JavaScript exception. */
export function projectVmRemovalErrorDetail(value) {
  try { return detail(value); } catch { return invalid(); }
}
export function emptyVmRemovalErrorDetail() {
  return { status: 'none', category: null, errorId: null, detailsPresent: null, targetPresent: null,
    nodes: [], truncated: false, cycle: false, unsupported: false, projectionFailed: false };
}
const unavailable = () => ({ ...emptyVmRemovalErrorDetail(), status: 'unavailable', projectionFailed: true });
const policy = Object.freeze({ rootCauseConfirmed: false, retryAllowed: false, liveOperationsEnabled: false });

/** A pure report has no native-result, absence, ownership, mutation or cleanup claims. */
export function projectVmRemovalErrorReport(value) {
  try {
    if (field(value, 'version') !== 1 || field(value, 'operation') !== 'remove_vm'
      || Object.entries(policy).some(([key, v]) => field(value, key) !== v)) return invalid();
    const primary = detail(field(value, 'primary'));
    const secondary = array(field(value, 'secondary'), removalErrorLimits.secondary).map(row => {
      const phase = field(row, 'phase'); if (!phases.includes(phase)) return invalid();
      const projected = detail(field(row, 'detail')); if (projected.status === 'none') return invalid();
      return { phase, detail: projected };
    });
    const secondaryTruncated = field(value, 'secondaryTruncated');
    if (typeof secondaryTruncated !== 'boolean' || (secondaryTruncated && secondary.length !== removalErrorLimits.secondary)
      || primary.nodes.length + secondary.reduce((count, row) => count + row.detail.nodes.length, 0) > removalErrorLimits.nodes) return invalid();
    const output = { version: 1, operation: 'remove_vm', primary, secondary, secondaryTruncated, ...policy };
    if (Buffer.byteLength(JSON.stringify(output)) > removalErrorLimits.bytes) return invalid();
    return output;
  } catch { return invalid(); }
}
export function createVmRemovalErrorReport(primary = emptyVmRemovalErrorDetail()) {
  return projectVmRemovalErrorReport({ version: 1, operation: 'remove_vm', primary,
    secondary: [], secondaryTruncated: false, ...policy });
}

/** Return a new report; later reporting failures can never replace or mutate the primary. */
export function appendVmRemovalSecondary(value, phase, failure) {
  const report = projectVmRemovalErrorReport(value);
  if (!phases.includes(phase)) return invalid();
  if (report.secondary.length === removalErrorLimits.secondary) return { ...report, secondaryTruncated: true };
  let projected;
  try { projected = detail(failure); if (projected.status === 'none') projected = unavailable(); }
  catch { projected = unavailable(); }
  const available = removalErrorLimits.nodes - report.primary.nodes.length
    - report.secondary.reduce((count, row) => count + row.detail.nodes.length, 0);
  if (projected.nodes.length > available) {
    projected = { ...projected, nodes: projected.nodes.slice(0, available), truncated: true,
      status: available ? 'partial' : 'unavailable' };
  }
  return projectVmRemovalErrorReport({ ...report, secondary: [...report.secondary, { phase, detail: projected }] });
}
