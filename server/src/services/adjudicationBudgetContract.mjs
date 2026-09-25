/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const ADJUDICATION_RESERVED_TOKENS = 8448;
export const ADJUDICATION_TICK_CALLS = 5;
export function validateAdjudicationBudget({ dailyCalls, dailyTokens }) {
  if (!Number.isInteger(dailyCalls) || dailyCalls < 0 || dailyCalls > 200 ||
      !Number.isInteger(dailyTokens) || dailyTokens < 0 || dailyTokens > 1689600 ||
      !(dailyCalls === 0 && dailyTokens === 0 || dailyCalls > 0 && dailyTokens >= ADJUDICATION_RESERVED_TOKENS)) {
    throw new Error('adjudication_budget_invalid');
  }
  return { dailyCalls, dailyTokens };
}
export function remainingAdjudicationCalls(state) {
  return Math.max(0, Math.min(ADJUDICATION_TICK_CALLS, state.daily_calls - state.calls_reserved,
    Math.floor((state.daily_tokens - state.tokens_reserved) / ADJUDICATION_RESERVED_TOKENS)));
}
export function projectAdjudicationBudget(state) {
  state ??= { status: 'disabled',daily_calls: 0,daily_tokens: 0,calls_reserved: 0,tokens_reserved: 0,
    selection_offset: 0,quota_day: null,next_check_at: null };
  return { version: 'adjudication_budget_status.v1', status: 'complete',
    captureStatus: state.status, dailyCalls: state.daily_calls, dailyTokens: state.daily_tokens,
    quotaDay: state.quota_day, callsReserved: state.calls_reserved, tokensReserved: state.tokens_reserved,
    nextCheckAt: state.next_check_at, selectionOffset: state.selection_offset,
    limits: { maximumCallsPerTick: ADJUDICATION_TICK_CALLS, tokensReservedPerCall: ADJUDICATION_RESERVED_TOKENS,
      usageIsReservation: true, routingWrites: 0, promotionAllowed: false } };
}
