/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const budgets = Object.freeze({
  baseline: Object.freeze({ cpus: 0, pids: -1 }),
  bounded: Object.freeze({ cpus: 2, pids: 128 }),
  stress: Object.freeze({ cpus: 1, pids: 128 }),
});

export function resourceStudyBudget(name) {
  if (typeof name !== 'string' || !Object.hasOwn(budgets, name)) throw new Error('resource_study_budget_invalid');
  return budgets[name];
}

export function assertStudyBudget(metrics, name) {
  const budget = resourceStudyBudget(name);
  if (!metrics || !Number.isSafeInteger(metrics.cpuPeriodUsec) || metrics.cpuPeriodUsec <= 0 ||
    !Number.isSafeInteger(metrics.cpuQuotaUsec) ||
    (budget.cpus === 0 ? metrics.cpuQuotaUsec !== -1 : metrics.cpuQuotaUsec / metrics.cpuPeriodUsec !== budget.cpus) ||
    metrics.pidsLimit !== budget.pids || metrics.pidsLimitHits !== 0 || metrics.limitBytes !== 2 * 1024 ** 3) {
    throw new Error('resource_study_budget_not_enforced');
  }
}

export function assertDockerStudyBudget(config, name) {
  const budget = resourceStudyBudget(name);
  if (!config || config.nanoCpus !== budget.cpus * 1e9 || config.memoryBytes !== 2 * 1024 ** 3 ||
    ![0, -1].includes(config.cpuQuota) ||
    (budget.pids === -1 ? ![null, 0, -1].includes(config.pids) : config.pids !== budget.pids)) {
    throw new Error('resource_study_docker_budget_mismatch');
  }
}

export function summarizeBudgetEnforcement(initial, final) {
  const keys = ['cpuUsec', 'cpuPeriods', 'cpuThrottledPeriods', 'throttledUsec', 'pidsLimitHits'];
  if (!keys.every(key => Number.isFinite(initial?.[key]) && Number.isFinite(final?.[key]) &&
    initial[key] >= 0 && final[key] >= initial[key])) throw new Error('resource_study_counter_regression');
  const delta = Object.fromEntries(keys.map(key => [key, final[key] - initial[key]]));
  return { ...delta, throttledPeriodPercent: delta.cpuPeriods > 0
    ? 100 * delta.cpuThrottledPeriods / delta.cpuPeriods : null };
}
