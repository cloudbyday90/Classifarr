/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ADJUDICATION_RESERVED_TOKENS } from './adjudicationBudgetContract.mjs';

const validMinute = value => Number.isInteger(value) && value >= 0 && value < 1440;
export function validateEvaluationWorkload(value) {
  const keys = ['revision','mode','dailyRequests','startMinute','endMinute'];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key)) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision >= 2147483647 ||
      !['off','when_idle','scheduled'].includes(value.mode) ||
      !Number.isInteger(value.dailyRequests) || value.dailyRequests < 0 || value.dailyRequests > 200 ||
      (value.mode === 'off' ? value.dailyRequests !== 0 : value.dailyRequests === 0) ||
      (value.mode === 'scheduled' ? !validMinute(value.startMinute) || !validMinute(value.endMinute) || value.startMinute === value.endMinute
        : value.startMinute !== null || value.endMinute !== null)) throw new Error('evaluation_workload_invalid');
  return Object.fromEntries(keys.map(key => [key,value[key]]));
}

export function projectEvaluationWorkload(row) {
  const state = row ?? { revision: 0,daily_calls: 0,daily_tokens: 0,workload_mode: 'when_idle',
    window_start_minute: null,window_end_minute: null,quota_day: null,calls_reserved: 0,next_check_at: null,status: 'disabled' };
  return { version: 'evaluation_workload.v1', revision: state.revision,
    mode: state.daily_calls === 0 ? 'off' : state.workload_mode,
    dailyRequests: Math.min(state.daily_calls,Math.floor(state.daily_tokens / ADJUDICATION_RESERVED_TOKENS)),
    startMinute: state.window_start_minute, endMinute: state.window_end_minute,
    quotaDay: state.quota_day, requestsReserved: state.calls_reserved, nextCheckAt: state.next_check_at,
    lastOutcome: state.status, windowOpen: state.window_open === true, scope: 'installation', timezone: 'UTC' };
}
