/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export const GATEWAY_TASK_SOURCE_HEADER = 'x-classifarr-task-source';
const types = new Set(['classification','metadata_enrichment','rating_normalization','rebuild_hnsw_index']);
const keys = ['version','kind','taskId','taskType','attempt'];
const invalid = () => gatewayError('gateway_task_source_invalid',400);

/** Caller-provided diagnostics, never ownership, consent or queue-claim authority. */
export function validateGatewayTaskSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length ||
      !keys.every(key => Object.hasOwn(value,key)) || value.version !== 1 || value.kind !== 'queue_task' ||
      typeof value.taskId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value.taskId) ||
      BigInt(value.taskId) > 9223372036854775807n || !types.has(value.taskType) ||
      !Number.isInteger(value.attempt) || value.attempt < 0 || value.attempt > 2147483647) throw invalid();
  return Object.freeze({ version: 1,kind: 'queue_task',taskId: value.taskId,taskType: value.taskType,attempt: value.attempt });
}

export function gatewayTaskSourceHeaders(value,compute) {
  if (value === undefined || value === null) return {};
  if (!compute) throw invalid();
  return { [GATEWAY_TASK_SOURCE_HEADER]: Buffer.from(JSON.stringify(validateGatewayTaskSource(value))).toString('base64url') };
}

export function readGatewayTaskSource(req,compute) {
  const count = req.rawHeaders.filter((_,index) => index % 2 === 0 &&
    req.rawHeaders[index].toLowerCase() === GATEWAY_TASK_SOURCE_HEADER).length;
  if (!count) return null;
  const value = req.headers[GATEWAY_TASK_SOURCE_HEADER];
  if (!compute || count !== 1 || typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  try {
    const bytes = Buffer.from(value,'base64url');
    if (bytes.toString('base64url') !== value) throw invalid();
    const source = validateGatewayTaskSource(JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(bytes)));
    // One canonical shape also rejects duplicate JSON keys, whitespace and hidden fields.
    if (gatewayTaskSourceHeaders(source,true)[GATEWAY_TASK_SOURCE_HEADER] !== value) throw invalid();
    return source;
  } catch { throw invalid(); }
}
