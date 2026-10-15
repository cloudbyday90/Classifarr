/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { validateGatewayTaskSource } from './taskSource.mjs';

export const GATEWAY_HISTORY_PAGE_SIZE = 25;
const integer = value => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const invalid = () => gatewayError('gateway_history_query_invalid',400);
const states = ['response_completed','provider_rejected','not_dispatched','completion_observed','active_or_uncertain','abandoned_after_review','outcome_not_recorded'];
const timestamp = value => typeof value === 'string' && value.length === 24 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** @param {{taskId?: string,before?: string}} [value] */
export function gatewayHistoryQuery(value = {}) {
  if (!object(value) || Object.keys(value).some(key => !['taskId','before'].includes(key)) ||
      Object.values(value).some(entry => !integer(entry))) throw invalid();
  return Object.freeze({ ...value });
}

export function gatewayHistoryPath(query = {}) {
  const params = new URLSearchParams(gatewayHistoryQuery(query)).toString();
  return `/gateway/history${params ? `?${params}` : ''}`;
}

export function readGatewayHistoryPath(path) {
  if (typeof path !== 'string' || path.length > 128 || path.includes('#') ||
      path !== '/gateway/history' && !path.startsWith('/gateway/history?')) throw invalid();
  const params = new URLSearchParams(path.slice('/gateway/history'.length).replace(/^\?/,''));
  if (new Set(params.keys()).size !== [...params.keys()].length) throw invalid();
  return gatewayHistoryQuery(Object.fromEntries(params));
}

/** Validate and project remote data; no arbitrary fields cross into the app API. */
export function gatewayHistoryResponse(value) {
  try {
    if (!object(value) || value.version !== 1 || typeof value.installation !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(value.installation) || !Array.isArray(value.items) ||
        value.items.length > GATEWAY_HISTORY_PAGE_SIZE || value.nextBefore !== null && !integer(value.nextBefore)) throw invalid();
    const items = value.items.map(row => {
      if (!object(row) || typeof row.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.requestId) ||
          !timestamp(row.admittedAt) || !integer(row.gatewayAttempt) ||
          row.operation !== null && !['/api/generate','/api/embed'].includes(row.operation) ||
          row.model !== null && (typeof row.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,199}$/.test(row.model)) ||
          !object(row.outcome) || !states.includes(row.outcome.state) ||
          row.outcome.recordedAt !== null && !timestamp(row.outcome.recordedAt) ||
          row.outcome.httpStatus !== null && ![200,400,401,403,404,429,503].includes(row.outcome.httpStatus)) throw invalid();
      const { state,recordedAt,httpStatus } = row.outcome;
      if ((['active_or_uncertain','outcome_not_recorded'].includes(state) ? recordedAt !== null : recordedAt === null) ||
          (state === 'response_completed' ? httpStatus !== 200 : state === 'provider_rejected'
            ? ![400,401,403,404,429,503].includes(httpStatus) : httpStatus !== null)) throw invalid();
      return { requestId: row.requestId,admittedAt: row.admittedAt,gatewayAttempt: row.gatewayAttempt,
        operation: row.operation,model: row.model,source: row.source === null ? null : validateGatewayTaskSource(row.source),
        outcome: { state: row.outcome.state,recordedAt: row.outcome.recordedAt,httpStatus: row.outcome.httpStatus } };
    });
    if (items.some((row,index) => index > 0 && BigInt(row.gatewayAttempt) >= BigInt(items[index-1].gatewayAttempt)) ||
        value.nextBefore !== null && (items.length !== GATEWAY_HISTORY_PAGE_SIZE || value.nextBefore !== items.at(-1).gatewayAttempt)) throw invalid();
    return { version: 1,installation: value.installation,items,nextBefore: value.nextBefore };
  } catch { throw gatewayError('gateway_history_response_invalid'); }
}
