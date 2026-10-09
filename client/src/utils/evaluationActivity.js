/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const policyStates = ['complete', 'never_run', 'failed', 'stale', 'unknown', 'no_policies', 'cache_incomplete', 'no_eligible_cases']
const captureStates = ['disabled', 'ready', 'captured', 'waiting_for_replay', 'budget_exhausted', 'deferred', 'unavailable', 'unknown']
const count = (value, max) => Number.isInteger(value) && value >= 0 && value <= max
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const keys = ['automatic', 'review', 'manual', 'unavailable']

/** Allowlisted projection: never keep raw reports, provider details or error text. */
export function normalizeEvaluationActivity(value) {
  if (!value || !validTime(value.checkedAt)) return null
  const { policy, capture } = value
  if (!policyStates.includes(policy?.status) || !(policy.observedAt === null || validTime(policy.observedAt))) return null
  let counts = null
  if (policy.status === 'complete') {
    const c = policy.counts
    const age = Date.parse(value.checkedAt) - Date.parse(policy.observedAt)
    if (!validTime(policy.observedAt) || age < 0 || age >= 900_000 || !c || !count(c.cases, 300) || !count(c.paired, c.cases)) return null
    for (const arm of [c.baseline, c.sourceAware]) {
      if (!arm || !keys.every(key => count(arm[key], c.cases)) || keys.reduce((sum, key) => sum + arm[key], 0) !== c.cases) return null
    }
    if (c.paired > Math.min(c.cases - c.baseline.unavailable, c.cases - c.sourceAware.unavailable) ||
      c.paired < c.cases - c.baseline.unavailable - c.sourceAware.unavailable) return null
    counts = { cases: c.cases, paired: c.paired, ...Object.fromEntries(['baseline', 'sourceAware'].map(arm =>
      [arm, Object.fromEntries(keys.map(key => [key, c[arm][key]]))])) }
  } else if (policy.counts !== null) return null
  if (!capture || !captureStates.includes(capture.lastOutcome)) return null
  if (capture.enabled === null) {
    if (capture.lastOutcome !== 'unknown' || ['dailyCalls', 'dailyTokens', 'quotaDay', 'callsReserved', 'tokensReserved'].some(key => capture[key] !== null)) return null
  } else if (typeof capture.enabled !== 'boolean' || !count(capture.dailyCalls, 200) || !count(capture.dailyTokens, 1689600) ||
    !count(capture.callsReserved, 200) || !count(capture.tokensReserved, 1689600) || capture.tokensReserved !== capture.callsReserved * 8448 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(capture.quotaDay ?? '') || !validTime(capture.quotaDay) ||
    new Date(capture.quotaDay).toISOString().slice(0, 10) !== capture.quotaDay ||
    !(capture.enabled ? capture.dailyCalls > 0 && capture.dailyTokens >= 8448 : capture.dailyCalls === 0 && capture.dailyTokens === 0)) return null
  return { checkedAt: value.checkedAt, policy: { status: policy.status, observedAt: policy.observedAt, counts },
    capture: Object.fromEntries(['enabled', 'dailyCalls', 'dailyTokens', 'quotaDay', 'callsReserved', 'tokensReserved', 'lastOutcome'].map(key => [key, capture[key]])) }
}

export const evaluationPolicyStatus = Object.freeze({
  never_run: 'No saved policy evaluation yet.',
  stale: 'The last policy evaluation is stale. These results do not confirm current worker activity.',
  failed: 'The last policy evaluation failed. Check evaluation diagnostics; imports and routing are separate.',
  unknown: 'Policy evaluation details are unavailable for this saved result.',
  no_policies: 'No active policies were available for the last evaluation.',
  cache_incomplete: 'The last evaluation was waiting for description vectors. Check library evidence coverage.',
  no_eligible_cases: 'No cases were available for the last evaluation.',
})

export const evaluationCaptureOutcome = Object.freeze({
  disabled: 'disabled', ready: 'ready for an admission check', captured: 'responses saved',
  waiting_for_replay: 'waiting for replay', budget_exhausted: 'quota exhausted', deferred: 'deferred',
  unavailable: 'unavailable', unknown: 'unknown',
})
